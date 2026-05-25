import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildInvoiceEmail } from "@/lib/email";

function currentPeriod() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function lastDayOfMonthISO(period: string) {
  const [y, m] = period.split("-").map(Number);
  // Day 0 of next month = last day of this month
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { tenantId } = body ?? {};
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  // Load tenant & verify ownership
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, name, email, unit, rent_amount, landlord_id")
    .eq("id", tenantId)
    .eq("landlord_id", user.id)
    .single();

  if (tErr || !tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const period = currentPeriod();
  const dueDate = lastDayOfMonthISO(period);

  // Find or create the invoice for this period
  let invoice: any = null;
  const { data: existing } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    if (existing.status === "paid") {
      return NextResponse.json(
        { error: `Already paid for ${period}.` },
        { status: 400 }
      );
    }
    invoice = existing;
  } else {
    const { data: created, error: iErr } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenant.id,
        landlord_id: user.id,
        amount: tenant.rent_amount,
        period,
        due_date: dueDate,
        status: "unpaid",
      })
      .select()
      .single();
    if (iErr || !created) {
      return NextResponse.json({ error: iErr?.message ?? "Failed to create invoice" }, { status: 400 });
    }
    invoice = created;
  }

  // Build absolute URL for the payment link
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    `https://${req.headers.get("host")}`;
  const paymentUrl = `${origin}/pay/${invoice.id}`;

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const landlordName =
    (user.user_metadata?.full_name as string) || user.email || "Your landlord";

  const { subject, html, text } = buildInvoiceEmail({
    tenantName: tenant.name,
    unit: tenant.unit,
    amount: invoice.amount,
    period,
    dueDate,
    paymentUrl,
    landlordName,
  });

  const resend = new Resend(resendKey);
  const { error: emailErr } = await resend.emails.send({
    from: `Mwenye Nyumba <${from}>`,
    to: tenant.email,
    subject,
    html,
    text,
    replyTo: user.email,
  });

  try {
    const resend = new Resend(resendKey);
    
    // Log data before sending to verify variables are alive
    console.log(`[Resend] Attempting to send from "${from}" to "${tenant.email}"`);

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: `Mwenye Nyumba <${from}>`,
      to: tenant.email,
      subject,
      html,
      text,
      replyTo: user.email,
    });

    if (emailErr) {
      console.error("[Resend Error Payload]:", emailErr);
      return NextResponse.json(
        { error: emailErr.message || "Resend rejected the request" }, 
        { status: 400 } // Swapped to 400 so your browser network panel can read it cleanly
      );
    }

    console.log("[Resend Success]:", emailData);

  } catch (caughtError: any) {
    // This catches complete network dropouts, bad API keys, or library crashes
    console.error("[Resend Critical Exception]:", caughtError);
    return NextResponse.json(
      { error: caughtError?.message || "Critical email connection exception" }, 
      { status: 500 }
    );
  }

  // Stamp the reminder time
  await supabase
    .from("invoices")
    .update({ last_reminder_sent_at: new Date().toISOString() })
    .eq("id", invoice.id);

  return NextResponse.json({ ok: true, invoiceId: invoice.id, period });
}
