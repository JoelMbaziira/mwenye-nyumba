import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildInvoiceEmail } from "@/lib/email";

/**
 * Vercel Cron — runs on the 1st of every month at 08:00 UTC.
 * Configured in vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 1 * *" }] }
 *
 * Vercel automatically sets the Authorization: Bearer <CRON_SECRET> header.
 * The CRON_SECRET env var is set in your Vercel project settings.
 */
export async function GET(req: Request) {
  // Verify this came from Vercel Cron (or manual call with correct secret)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient();
  const period = currentPeriod();
  const dueDate = lastDayOfMonthISO(period);
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://mwenyenyumba.vercel.app";

  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const resend = new Resend(resendKey);

  // Load every landlord's active tenants (with unit+property for rent amount)
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, email, landlord_id, units(id, number, rent_amount, properties(name))");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const tenant of tenants ?? []) {
    const unit = (tenant as any).units;
    if (!unit?.rent_amount) { results.skipped++; continue; }

    // Skip if invoice already exists for this period
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .eq("period", period)
      .maybeSingle();

    if (existing?.status === "paid" || existing?.status === "pending") { results.skipped++; continue; }

    let invoiceId: string;

    if (existing) {
      invoiceId = existing.id;
    } else {
      // Create the invoice
      const { data: created, error: iErr } = await supabase
        .from("invoices")
        .insert({
          tenant_id: tenant.id,
          unit_id: unit.id,
          landlord_id: tenant.landlord_id,
          amount: unit.rent_amount,
          period,
          due_date: dueDate,
          status: "unpaid",
        })
        .select("id")
        .single();

      if (iErr || !created) { results.errors++; continue; }
      invoiceId = created.id;
    }

    // Load landlord profile for the email
    const { data: landlordUser } = await supabase.auth.admin.getUserById(tenant.landlord_id);
    const landlordName = landlordUser?.user?.user_metadata?.full_name || landlordUser?.user?.email || "Your landlord";

    const unitLabel = unit.number ? `Unit ${unit.number}` : "—";
    const propertyName = unit.properties?.name ?? "";
    const displayUnit = propertyName ? `${propertyName} · ${unitLabel}` : unitLabel;

    const { subject, html, text } = buildInvoiceEmail({
      tenantName: tenant.name,
      unit: displayUnit,
      amount: unit.rent_amount,
      period,
      dueDate,
      paymentUrl: `${origin}/pay/${invoiceId}`,
      landlordName,
    });

    try {
      const { error: emailErr } = await resend.emails.send({
        from: `Mwenye Nyumba <${from}>`,
        to: tenant.email,
        subject, html, text,
      });
      if (emailErr) { results.errors++; continue; }

      // Stamp last_reminder_sent_at
      await supabase.from("invoices").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", invoiceId);
      results.sent++;
    } catch { results.errors++; }
  }

  return NextResponse.json({ ok: true, period, ...results });
}

function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonthISO(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
