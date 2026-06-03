// lib/reminders.ts
//
// Decides whether a tenant should get a reminder TODAY, what tone, and over
// which channels. Run by /api/cron/reminders daily.

export type ReminderTier = "pre_due" | "due" | "overdue";

export interface ReminderSchedule {
  daysOffset: number;  // negative = before due, 0 = day of, positive = days late
  tier: ReminderTier;
  tone: "gentle" | "neutral" | "firm";
}

/**
 * The schedule. Each entry is a day on which a reminder fires, relative to
 * the invoice's due_date. Tweak freely — the cron picks whichever entry
 * matches `today − due_date`.
 */
export const REMINDER_SCHEDULE: ReminderSchedule[] = [
  { daysOffset: -3, tier: "pre_due", tone: "gentle" },   // 3 days before
  { daysOffset:  0, tier: "due",     tone: "neutral" },  // day of
  { daysOffset:  7, tier: "overdue", tone: "firm"    },  // a week late
];

export function findTierForToday(dueDate: Date, today: Date = new Date()): ReminderSchedule | null {
  const msPerDay = 24 * 60 * 60 * 1000;
  // Normalize both to UTC midnight before subtracting
  const a = Date.UTC(today.getUTCFullYear(),  today.getUTCMonth(),  today.getUTCDate());
  const b = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const offset = Math.round((a - b) / msPerDay);  // today − due_date
  return REMINDER_SCHEDULE.find((s) => s.daysOffset === offset) ?? null;
}

interface BuildMessageInput {
  tenantName: string;
  propertyName: string | null;
  unitNumber: string | null;
  balance: number;
  dueDate: string;       // ISO
  payUrl: string;
  tier: ReminderTier;
}

export function buildReminderText({
  tenantName, propertyName, unitNumber, balance, dueDate, payUrl, tier,
}: BuildMessageInput): { subject: string; body: string; whatsapp: string } {
  const fmtAmount = "UGX " + new Intl.NumberFormat("en-UG").format(Math.round(balance));
  const due = new Date(dueDate).toLocaleDateString("en-UG",
    { day: "numeric", month: "long", year: "numeric" });
  const where = [propertyName, unitNumber ? `Unit ${unitNumber}` : null].filter(Boolean).join(" · ");

  let subject: string;
  let opener: string;
  let nudge: string;

  if (tier === "pre_due") {
    subject = `Rent reminder: ${fmtAmount} due ${due}`;
    opener  = `This is a friendly reminder that your rent is due in a few days.`;
    nudge   = `If you've already paid, please ignore this message.`;
  } else if (tier === "due") {
    subject = `Rent due today: ${fmtAmount}`;
    opener  = `Your rent of ${fmtAmount} is due today.`;
    nudge   = `Please make payment when you can.`;
  } else {
    subject = `Rent overdue: ${fmtAmount}`;
    opener  = `Your rent of ${fmtAmount} is now overdue (was due ${due}).`;
    nudge   = `Please clear the balance as soon as possible, or reach out to your landlord if you need to discuss a payment plan.`;
  }

  const body =
`Hi ${tenantName},

${opener}

Balance:  ${fmtAmount}
Property: ${where || "—"}
Due date: ${due}

You can pay online here:
${payUrl}

${nudge}

— Mwenye Nyumba`;

  const whatsapp =
`Hi ${tenantName}, ${tier === "overdue" ? "your rent is overdue" : "rent reminder"} — ` +
`${fmtAmount} ${tier === "pre_due" ? "due " + due : tier === "due" ? "due today" : "(was due " + due + ")"}. ` +
`Pay here: ${payUrl}`;

  return { subject, body, whatsapp };
}
