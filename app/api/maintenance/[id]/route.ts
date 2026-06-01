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
  if (typeof body.status === "string") {
    updates.status = body.status;
    if (body.status === "resolved" || body.status === "closed") {
      updates.resolved_at = new Date().toISOString();
    }
  }
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (typeof body.priority === "string") updates.priority = body.priority;
  if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
  if (body.actual_cost !== undefined) updates.actual_cost = body.actual_cost ? Number(body.actual_cost) : null;

  const { data, error } = await supabase
    .from("maintenance_requests").update(updates).eq("id", id).eq("landlord_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ request: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("maintenance_requests").delete().eq("id", id).eq("landlord_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
