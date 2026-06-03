// lib/whatsapp.ts
//
// Sends a WhatsApp message via Meta WhatsApp Cloud API.
// Inactive unless WHATSAPP_TOKEN + WHATSAPP_PHONE_ID env vars are set.
//
// To enable:
//   1. Create a Meta Business account + WhatsApp Business app
//      (https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
//   2. Grab the Access Token and the Phone Number ID from the app dashboard
//   3. Set in Vercel:
//        WHATSAPP_TOKEN     = EAAxxxxxxxxxxx...
//        WHATSAPP_PHONE_ID  = 123456789012345
//   4. For initial testing, Meta sandbox only lets you message phones added
//      as "test recipients" in the app dashboard. Production requires a
//      verified WhatsApp Business profile and message templates.

export interface WhatsappResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

const TOKEN    = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export function whatsappEnabled(): boolean {
  return Boolean(TOKEN && PHONE_ID);
}

/** Normalize a phone to international form without "+", spaces, or dashes */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Send a plain-text WhatsApp message.
 * Note: Meta only allows free-form text within a 24h window of the recipient's
 * last message to your number. Outside that window, you must use a pre-approved
 * template (see Meta docs). For payment reminders, register a template called
 * `rent_reminder` with variables {1}=name {2}=amount {3}=due_date {4}=pay_url
 * and use sendWhatsappTemplate() below in production.
 */
export async function sendWhatsappText(to: string, text: string): Promise<WhatsappResult> {
  if (!whatsappEnabled()) return { ok: false, error: "WhatsApp not configured" };
  const phone = normalizePhone(to);
  if (phone.length < 10) return { ok: false, error: "Invalid phone number" };

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
