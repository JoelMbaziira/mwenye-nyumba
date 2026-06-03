import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let note: string | null = null;
  try { const body = await req.json(); note = body?.note ?? null; } catch {}

  const { data, error } = await supabase.rpc("reject_payment", { p_payment_id: id, p_note: note });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Payment not found or already processed." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
