import { createClient } from "@/lib/supabase/server";
import { AddPropertyDialog } from "@/components/add-property-dialog";
import { PropertyCard } from "@/components/property-card";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, address, type, description, created_at, units(id, number, status, rent_amount, tenants(id, name))")
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: true });

  const totalUnits     = (properties ?? []).flatMap((p: any) => p.units ?? []).length;
  const occupiedUnits  = (properties ?? []).flatMap((p: any) => p.units ?? []).filter((u: any) => u.status === "occupied").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Portfolio</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Properties</h1>
          {totalUnits > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {occupiedUnits} of {totalUnits} units occupied across {(properties ?? []).length} properties
            </p>
          )}
        </div>
        <AddPropertyDialog />
      </div>

      {(properties ?? []).length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-white/60 p-14 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-3 font-display text-xl font-semibold">No properties yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add your first property to start managing units and tenants.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(properties ?? []).map((p: any) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
