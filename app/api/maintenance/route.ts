import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { title, description, category, priority, property_id, unit_id, tenant_id, estimated_cost } = body ?? {};
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("maintenance_requests")
    .insert({
      landlord_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      category: category || "other",
      priority: priority || "normal",
      property_id: property_id || null,
      unit_id: unit_id || null,
      tenant_id: tenant_id || null,
      estimated_cost: estimated_cost ? Number(estimated_cost) : null,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ request: data });
}
