import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { AddMaintenanceDialog } from "@/components/add-maintenance-dialog";
import { MaintenanceList } from "@/components/maintenance-list";
import { Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

export type MaintenanceRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  property: { id: string; name: string } | null;
  unit: { id: string; number: string } | null;
  tenant: { id: string; name: string } | null;
};

export default async function MaintenancePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: requests }, { data: properties }] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select(`
        id, title, description, category, priority, status,
        estimated_cost, actual_cost, notes, created_at, resolved_at,
        properties(id, name), units(id, number), tenants(id, name)
      `)
      .eq("landlord_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("properties")
      .select("id, name, units(id, number)")
      .eq("landlord_id", user.id),
  ]);

  const rows: MaintenanceRow[] = (requests ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    estimated_cost: r.estimated_cost,
    actual_cost: r.actual_cost,
    notes: r.notes,
    created_at: r.created_at,
    resolved_at: r.resolved_at,
    property: r.properties ?? null,
    unit: r.units ?? null,
    tenant: r.tenants ?? null,
  }));

  const open      = rows.filter((r) => r.status === "open").length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;
  const resolved  = rows.filter((r) => r.status === "resolved" || r.status === "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Repairs</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Maintenance</h1>
        </div>
        <AddMaintenanceDialog properties={properties ?? []} />
      </div>

      {/* Status pills */}
      <div className="flex gap-3">
        {[
          { label: "Open",        count: open,       color: "bg-red-100 text-red-700" },
          { label: "In progress", count: inProgress, color: "bg-amber-100 text-amber-700" },
          { label: "Resolved",    count: resolved,   color: "bg-emerald-100 text-emerald-700" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`rounded-full px-3 py-1 text-xs font-medium ${color}`}>
            {count} {label}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
          <Wrench className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <h3 className="mt-3 font-display text-xl font-semibold">No maintenance requests</h3>
          <p className="mt-1 text-sm text-muted-foreground">Log a repair or maintenance issue to track it here.</p>
        </div>
      ) : (
        <MaintenanceList rows={rows} />
      )}
    </div>
  );
}
