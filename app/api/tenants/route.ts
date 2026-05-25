import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, unit, rent_amount } = body ?? {};
  if (!name || !email || !unit || typeof rent_amount !== "number" || rent_amount <= 0) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      landlord_id: user.id,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      unit: String(unit).trim(),
      rent_amount,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tenant: data });
}
