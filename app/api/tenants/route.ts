import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, email, phone, unit_id, national_id, emergency_contact, notes } = body ?? {};
  if (!name?.trim() || !email?.trim()) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  if (unit_id) {
    // 1. Verify unit belongs to this landlord
    const { data: unit } = await supabase.from("units").select("id, status").eq("id", unit_id).eq("landlord_id", user.id).single();
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

    // 2. DB-level double-booking check: reject if any tenant already assigned to this unit
    const { data: existing } = await supabase.from("tenants").select("id, name").eq("unit_id", unit_id).maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: `Unit is already occupied by ${existing.name}. Remove the current tenant first.` },
        { status: 409 }
      );
    }

    // 3. Mark unit occupied
    await supabase.from("units").update({ status: "occupied" }).eq("id", unit_id);
  }

  const { data, error } = await supabase.from("tenants").insert({
    landlord_id: user.id,
    unit_id: unit_id || null,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    national_id: national_id?.trim() || null,
    emergency_contact: emergency_contact?.trim() || null,
    notes: notes?.trim() || null,
  }).select().single();

  if (error) {
    // Catch the DB unique constraint violation too (belt and suspenders)
    if (error.code === "23505" && error.message.includes("tenants_one_per_unit")) {
      return NextResponse.json({ error: "This unit is already assigned to another tenant." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ tenant: data });
}
