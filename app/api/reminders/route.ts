import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildInvoiceEmail } from "@/lib/email";

function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonthISO(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { tenantId } = body ?? {};
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  // Load tenant with unit info
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, name, email, landlord_id, units(id, number, rent_amount, properties(name))")
    .eq("id", tenantId)
    .eq("landlord_id", user.id)
    .single();

  if (tErr || !tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const unit = (tenant as any).units;
  const rentAmount = unit?.rent_amount;
  const unitLabel = unit?.number ? `Unit ${unit.number}` : "—";
  const propertyName = unit?.properties?.name ?? "";

  if (!rentAmount || rentAmount <= 0) {
    return NextResponse.json({ error: "Tenant has no rent amount configured (assign to a unit first)" }, { status: 400 });
  }

  const period = currentPeriod();
  const dueDate = lastDayOfMonthISO(period);

  // Find or create invoice
  const { data: existing } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("period", period)
    .maybeSingle();

  let invoice: any;
  if (existing) {
    if (existing.status === "paid") return NextResponse.json({ error: `Already paid for ${period}.` }, { status: 400 });
    invoice = existing;
  } else {
    const { data: created, error: iErr } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenant.id,
        unit_id: unit?.id ?? null,
        landlord_id: user.id,
        amount: rentAmount,
        period,
        due_date: dueDate,
        status: "unpaid",
      })
      .select().single();
    if (iErr || !created) return NextResponse.json({ error: iErr?.message ?? "Failed to create invoice" }, { status: 400 });
    invoice = created;
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || `https://${req.headers.get("host")}`;
  const paymentUrl = `${origin}/pay/${invoice.id}`;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });

  const landlordName = (user.user_metadata?.full_name as string) || user.email || "Your landlord";
  const displayUnit = propertyName ? `${propertyName} · ${unitLabel}` : unitLabel;

  const { subject, html, text } = buildInvoiceEmail({
    tenantName: tenant.name,
    unit: displayUnit,
    amount: invoice.amount,
    period,
    dueDate,
    paymentUrl,
    landlordName,
  });

  try {
    const resend = new Resend(resendKey);
    const { error: emailErr } = await resend.emails.send({
      from: `Mwenye Nyumba <${from}>`,
      to: tenant.email,
      subject, html, text,
      replyTo: user.email,
    });
    if (emailErr) return NextResponse.json({ error: emailErr.message || "Email send failed" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Email exception" }, { status: 500 });
  }

  await supabase.from("invoices").update({ last_reminder_sent_at: new Date().toISOString() }).eq("id", invoice.id);

  return NextResponse.json({ ok: true, invoiceId: invoice.id, period });
}
