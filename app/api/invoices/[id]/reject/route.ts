import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("reject_invoice", { invoice_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Invoice not found or not in pending state." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
