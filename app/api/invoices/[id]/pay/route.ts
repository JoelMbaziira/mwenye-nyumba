import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_PROVIDERS = new Set(["MTN MoMo", "Airtel Money", "M-Pesa"]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  // 1. Unbox the dynamic invoice ID safely by awaiting the promise
  const { id } = await params;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { phone, provider } = body ?? {};

  if (!phone || typeof phone !== "string" || phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }
  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Select a provider." }, { status: 400 });
  }

  // Simulate small mobile-money confirmation delay
  await new Promise((r) => setTimeout(r, 600));

  const supabase = createClient();
  const { data, error } = await supabase.rpc("pay_invoice", {
    invoice_id: id, // 2. Used the cleanly unwrapped string variable here
    pay_phone: phone,
    pay_provider: provider,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (data !== true) {
    return NextResponse.json({ error: "Invoice not found or already paid." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}