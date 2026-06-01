import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MOBILE_PROVIDERS = new Set(["MTN MoMo", "Airtel Money", "M-Pesa"]);
const CARD_PROVIDERS = new Set(["Visa", "Mastercard"]);

// 1. Updated 'req' to NextRequest and wrapped 'params' inside a Promise
export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> } 
) {
  // 2. Await the params right away to extract the invoice ID
  const { id } = await params;

  let body: any;
  try { 
    body = await req.json(); 
  } catch { 
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); 
  }

  const { phone, provider, method, cardNumber, cardExpiry, cardName } = body ?? {};
  const isCard = method === "card" || CARD_PROVIDERS.has(provider);

  if (isCard) {
    // Card validation
    if (!provider || !CARD_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "Select a card network." }, { status: 400 });
    }
    const rawCard = (cardNumber ?? "").replace(/\s/g, "");
    if (!rawCard || rawCard.length < 15 || rawCard.length > 16) {
      return NextResponse.json({ error: "Enter a valid card number." }, { status: 400 });
    }
    if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      return NextResponse.json({ error: "Enter a valid expiry date." }, { status: 400 });
    }
    if (!cardName || !cardName.trim()) {
      return NextResponse.json({ error: "Enter the name on the card." }, { status: 400 });
    }

    // Simulate card processing delay
    await new Promise((r) => setTimeout(r, 900));

    const supabase = createClient();
    const { data, error } = await supabase.rpc("pay_invoice", {
      invoice_id: id, // Used the awaited id here
      pay_phone: `****${rawCard.slice(-4)}`,
      pay_provider: provider,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (data !== true) return NextResponse.json({ error: "Invoice not found or already paid." }, { status: 400 });

    return NextResponse.json({ ok: true });

  } else {
    // Mobile money validation
    if (!phone || typeof phone !== "string" || phone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }
    if (!provider || !MOBILE_PROVIDERS.has(provider)) {
      return NextResponse.json({ error: "Select a provider." }, { status: 400 });
    }

    // Simulate mobile money confirmation delay
    await new Promise((r) => setTimeout(r, 600));

    const supabase = createClient();
    const { data, error } = await supabase.rpc("pay_invoice", {
      invoice_id: id, // Used the awaited id here
      pay_phone: phone,
      pay_provider: provider,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (data !== true) return NextResponse.json({ error: "Invoice not found or already paid." }, { status: 400 });

    return NextResponse.json({ ok: true });
  }
}