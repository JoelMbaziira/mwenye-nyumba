import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  const { id: propertyId } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify property belongs to landlord
  const { data: prop } = await supabase.from("properties").select("id").eq("id", propertyId).eq("landlord_id", user.id).single();
  if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { number, bedrooms, bathrooms, rent_amount, notes } = body ?? {};
  if (!number?.trim()) return NextResponse.json({ error: "Unit number required" }, { status: 400 });
  if (!rent_amount || Number(rent_amount) <= 0) return NextResponse.json({ error: "Valid rent amount required" }, { status: 400 });

  const { data, error } = await supabase
    .from("units")
    .insert({
      property_id: propertyId, landlord_id: user.id,
      number: number.trim(), bedrooms: bedrooms ? Number(bedrooms) : null,
      bathrooms: bathrooms ? Number(bathrooms) : null,
      rent_amount: Number(rent_amount), notes: notes?.trim() || null,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ unit: data });
}
