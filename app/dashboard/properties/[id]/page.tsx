import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { AddUnitDialog } from "@/components/add-unit-dialog";
import { UnitCard } from "@/components/unit-card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Home } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential", commercial: "Commercial",
  multifamily: "Multifamily",  mixed_use: "Mixed Use",
  land: "Land",                industrial: "Industrial",
  short_term: "Short-term Rental",
};

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch property and units separately — avoids fragile nested FK joins
  const [{ data: property }, { data: rawUnits }] = await Promise.all([
    supabase.from("properties")
      .select("id, name, address, type, description")
      .eq("id", id)
      .eq("landlord_id", user.id)
      .single(),
    supabase.from("units")
      .select("id, number, bedrooms, bathrooms, rent_amount, status, notes")
      .eq("property_id", id)
      .eq("landlord_id", user.id)
      .order("number"),
  ]);

  if (!property) notFound();

  // Fetch tenants for each unit (safe — works with or without unit_id FK)
  const unitIds = (rawUnits ?? []).map((u) => u.id);
  const { data: tenants } = unitIds.length > 0
    ? await supabase.from("tenants")
        .select("id, name, email, phone, unit_id")
        .in("unit_id", unitIds)
    : { data: [] };

  const tenantByUnit = new Map((tenants ?? []).map((t) => [t.unit_id, t]));

  const units = (rawUnits ?? []).map((u) => ({
    ...u,
    tenant: tenantByUnit.get(u.id) ?? null,
  }));

  const occupied   = units.filter((u) => u.status === "occupied").length;
  const totalRent  = units.filter((u) => u.status === "occupied").reduce((s, u) => s + u.rent_amount, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/properties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Properties
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{property.name}</h1>
            <Badge variant="outline" className="capitalize">{TYPE_LABELS[property.type] ?? property.type}</Badge>
          </div>
          {property.address && <p className="mt-1 text-sm text-muted-foreground">{property.address}</p>}
        </div>
        <AddUnitDialog propertyId={property.id} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total units", value: String(units.length) },
          { label: "Occupied",    value: `${occupied} / ${units.length}` },
          { label: "Monthly rent",value: formatCurrency(totalRent) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-white p-4 text-center shadow-sm">
            <p className="font-display text-2xl font-semibold">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 font-display text-xl font-semibold">Units</h2>
        {units.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white/60 p-8 text-center">
            <Home className="mx-auto h-7 w-7 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No units yet. Add the first one above.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} propertyId={property.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}