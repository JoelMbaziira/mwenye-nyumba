import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updates: Record<string, any> = {};
  if (typeof body.number === "string") updates.number = body.number.trim();
  if (typeof body.rent_amount === "number" && body.rent_amount > 0) updates.rent_amount = body.rent_amount;
  if (body.bedrooms !== undefined) updates.bedrooms = body.bedrooms ? Number(body.bedrooms) : null;
  if (body.bathrooms !== undefined) updates.bathrooms = body.bathrooms ? Number(body.bathrooms) : null;
  if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
  if (typeof body.status === "string") updates.status = body.status;

  const { data, error } = await supabase.from("units").update(updates).eq("id", id).eq("landlord_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ unit: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("units").delete().eq("id", id).eq("landlord_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
