import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { findTierForToday, buildReminderText } from "@/lib/reminders";
import { sendWhatsappText, whatsappEnabled } from "@/lib/whatsapp";

/**
 * Vercel Cron — runs daily at 08:00 UTC.
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
 *
 * For each tenant with an unpaid invoice:
 *   1. Compute real balance (invoice.amount − approved payments)
 *   2. Skip if balance ≤ 0 (tenant is paid up or in credit)
 *   3. See if today is a reminder day per the schedule in lib/reminders.ts
 *   4. Skip if a reminder for this (invoice, channel, day-offset) was already
 *      sent (the reminders_sent_dedup unique index enforces this in SQL too)
 *   5. Send via email (Resend) AND WhatsApp (if configured + tenant has phone)
 *   6. Log every attempt to reminders_sent so the landlord sees the history
 */

export async function GET(req: Request) {
  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }
  const resend = new Resend(resendKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const origin    = process.env.NEXT_PUBLIC_APP_URL || "https://mwenyenyumba.vercel.app";

  const supabase = createClient();
  const today = new Date();

  // Pull every non-paid invoice with tenant + unit info
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id, amount, due_date, period, status, tenant_id, landlord_id,
      tenants ( id, name, email, phone ),
      units   ( number, properties ( name ) )
    `)
    .neq("status", "paid");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = {
    examined: invoices?.length ?? 0,
    skipped_no_balance: 0,
    skipped_wrong_day:  0,
    skipped_already_sent: 0,
    email_sent: 0, email_failed: 0,
    whatsapp_sent: 0, whatsapp_failed: 0,
    whatsapp_disabled: !whatsappEnabled(),
  };

  for (const inv of invoices ?? []) {
    // 1. Tier check — is today a send day?
    const due = new Date(inv.due_date);
    const tier = findTierForToday(due, today);
    if (!tier) { summary.skipped_wrong_day++; continue; }

    // 2. Balance check — does this tenant actually owe anything?
    const { data: paidRows } = await supabase
      .from("payments")
      .select("amount")
      .eq("invoice_id", inv.id)
      .eq("status", "approved");

    const paid    = (paidRows ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
    const balance = Number(inv.amount) - paid;
    if (balance <= 0) { summary.skipped_no_balance++; continue; }

    const tenant: any = inv.tenants;
    const unit:   any = inv.units;
    const property = unit?.properties;
    if (!tenant) continue;

    const messageInput = {
      tenantName:   tenant.name ?? "Tenant",
      propertyName: property?.name ?? null,
      unitNumber:   unit?.number ?? null,
      balance,
      dueDate:      inv.due_date,
      payUrl:       `${origin}/pay/${inv.id}`,
      tier:         tier.tier,
    };
    const msg = buildReminderText(messageInput);

    // 3. Email
    if (tenant.email) {
      // Dedupe — was an email already sent for this invoice on this day-offset?
      const { data: dup } = await supabase
        .from("reminders_sent")
        .select("id")
        .eq("invoice_id", inv.id)
        .eq("channel", "email")
        .eq("days_offset", tier.daysOffset)
        .eq("status", "sent")
        .maybeSingle();

      if (dup) {
        summary.skipped_already_sent++;
      } else {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: tenant.email,
            subject: msg.subject,
            text: msg.body,
          });
          await supabase.from("reminders_sent").insert({
            invoice_id: inv.id, tenant_id: tenant.id, landlord_id: inv.landlord_id,
            channel: "email", tier: tier.tier, days_offset: tier.daysOffset,
            balance, status: "sent",
          });
          summary.email_sent++;
        } catch (e: any) {
          await supabase.from("reminders_sent").insert({
            invoice_id: inv.id, tenant_id: tenant.id, landlord_id: inv.landlord_id,
            channel: "email", tier: tier.tier, days_offset: tier.daysOffset,
            balance, status: "failed", error: e.message,
          });
          summary.email_failed++;
        }
      }
    }

    // 4. WhatsApp (only if configured + tenant has phone)
    if (whatsappEnabled() && tenant.phone) {
      const { data: dup } = await supabase
        .from("reminders_sent")
        .select("id")
        .eq("invoice_id", inv.id)
        .eq("channel", "whatsapp")
        .eq("days_offset", tier.daysOffset)
        .eq("status", "sent")
        .maybeSingle();

      if (!dup) {
        const r = await sendWhatsappText(tenant.phone, msg.whatsapp);
        if (r.ok) {
          await supabase.from("reminders_sent").insert({
            invoice_id: inv.id, tenant_id: tenant.id, landlord_id: inv.landlord_id,
            channel: "whatsapp", tier: tier.tier, days_offset: tier.daysOffset,
            balance, status: "sent",
          });
          summary.whatsapp_sent++;
        } else {
          await supabase.from("reminders_sent").insert({
            invoice_id: inv.id, tenant_id: tenant.id, landlord_id: inv.landlord_id,
            channel: "whatsapp", tier: tier.tier, days_offset: tier.daysOffset,
            balance, status: "failed", error: r.error,
          });
          summary.whatsapp_failed++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, ranAt: today.toISOString(), summary });
}
