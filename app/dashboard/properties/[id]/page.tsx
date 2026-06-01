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
  multifamily: "Multifamily", mixed_use: "Mixed Use",
  land: "Land", industrial: "Industrial", short_term: "Short-term Rental",
};

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: property } = await supabase
    .from("properties")
    .select(`
      id, name, address, type, description,
      units(
        id, number, bedrooms, bathrooms, rent_amount, status, notes,
        tenants(id, name, email, phone)
      )
    `)
    .eq("id", params.id)
    .eq("landlord_id", user.id)
    .single();

  if (!property) notFound();

  const units: any[] = property.units ?? [];
  const occupied = units.filter((u) => u.status === "occupied").length;
  const totalRent = units
    .filter((u) => u.status === "occupied")
    .reduce((s: number, u: any) => s + u.rent_amount, 0);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/properties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Properties
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{property.name}</h1>
            <Badge variant="outline" className="capitalize">{TYPE_LABELS[property.type] ?? property.type}</Badge>
          </div>
          {property.address && (
            <p className="mt-1 text-sm text-muted-foreground">{property.address}</p>
          )}
        </div>
        <AddUnitDialog propertyId={property.id} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total units", value: String(units.length) },
          { label: "Occupied", value: `${occupied} / ${units.length}` },
          { label: "Monthly rent", value: formatCurrency(totalRent) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-card p-4 text-center">
            <p className="font-display text-2xl font-semibold">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Units */}
      <div>
        <h2 className="mb-3 font-display text-xl font-semibold">Units</h2>
        {units.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/40 p-8 text-center">
            <Home className="mx-auto h-7 w-7 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No units yet. Add the first one.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((unit: any) => (
              <UnitCard key={unit.id} unit={unit} propertyId={property.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
