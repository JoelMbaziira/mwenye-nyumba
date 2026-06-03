import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/tenants
 *
 * Creates a tenant AND flips the unit to occupied atomically via the
 * create_tenant RPC. If anything fails, nothing is inserted — no more
 * orphan "occupied" units left by half-failed creates.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, email, phone, unit_id, national_id, emergency_contact, notes } = body ?? {};

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tenant name is required." }, { status: 400 });
  }
  if (!unit_id) {
    return NextResponse.json({ error: "Pick a unit for this tenant." }, { status: 400 });
  }
  if (!phone?.trim() && !email?.trim()) {
    return NextResponse.json(
      { error: "Provide at least a phone number or email." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("create_tenant", {
    p_name:              name.trim(),
    p_phone:             phone?.trim() || null,
    p_email:             email?.trim().toLowerCase() || null,
    p_unit_id:           unit_id,
    p_national_id:       national_id?.trim() || null,
    p_emergency_contact: emergency_contact?.trim() || null,
    p_notes:             notes?.trim() || null,
  });

  if (error) {
    // Friendly messages for common cases
    const msg = error.message || "";
    if (msg.includes("already occupied")) {
      return NextResponse.json(
        { error: "That unit is already occupied. Remove the current tenant first." },
        { status: 409 }
      );
    }
    if (msg.includes("Unit not found")) {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tenant_id: data });
}
