import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Type definitions ensuring params is treated as a Promise globally for these routes
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  // 1. Await the params promise to extract the tenant id cleanly
  const { id } = await params;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updates: Record<string, any> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
  if (typeof body.unit === "string") updates.unit = body.unit.trim();
  if (typeof body.rent_amount === "number" && body.rent_amount > 0) updates.rent_amount = body.rent_amount;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", id) // 2. Use the cleanly unwrapped id string
    .eq("landlord_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tenant: data });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  // 1. Await the params promise here as well
  const { id } = await params;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("tenants")
    .delete()
    .eq("id", id) // 2. Use the cleanly unwrapped id string
    .eq("landlord_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}