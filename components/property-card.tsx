"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Home, MoreHorizontal, Trash2, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TYPE_LABELS } from "@/components/add-property-dialog";

const GRADIENTS = [
  "from-emerald-900 to-emerald-700",
  "from-teal-900 to-teal-700",
  "from-green-900 to-green-700",
  "from-slate-800 to-slate-600",
  "from-cyan-900 to-cyan-700",
];

export function PropertyCard({ property }: { property: any }) {
  const router = useRouter();
  const units: any[] = property.units ?? [];
  const occupied = units.filter((u: any) => u.status === "occupied").length;
  const totalRent = units.filter((u: any) => u.status === "occupied").reduce((s: number, u: any) => s + u.rent_amount, 0);
  const rate = units.length > 0 ? Math.round((occupied / units.length) * 100) : 0;
  const grad = GRADIENTS[property.name.charCodeAt(0) % GRADIENTS.length];

  async function handleDelete() {
    if (!confirm(`Delete "${property.name}"? All units and tenant data will be removed.`)) return;
    try {
      const res = await fetch(`/api/properties/${property.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success("Property deleted.");
      router.refresh();
    } catch (e: any) { toast.error(e.message || "Could not delete."); }
  }

  return (
    <div className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
      {/* Gradient header with occupancy badge */}
      <Link href={`/dashboard/properties/${property.id}`} className="block">
        <div className={`relative h-32 bg-gradient-to-br ${grad} flex items-end p-4`}>
          <Building2 className="absolute right-4 top-4 h-10 w-10 text-white/20" />
          <div className={`rounded-full px-2.5 py-1 text-xs font-bold text-white shadow ${
            rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500"
          }`}>
            {rate}% occupied
          </div>
        </div>
      </Link>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/dashboard/properties/${property.id}`}>
              <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors">{property.name}</h3>
            </Link>
            {property.address && <p className="mt-0.5 truncate text-xs text-muted-foreground">{property.address}</p>}
            <p className="mt-1 text-xs text-muted-foreground capitalize">{TYPE_LABELS[property.type] ?? property.type}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/properties/${property.id}`}><ArrowRight className="h-4 w-4" /> View units</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Home className="h-3.5 w-3.5" />
            {occupied}/{units.length} units
          </div>
          {totalRent > 0 && (
            <p className="font-mono text-sm font-semibold text-primary">{formatCurrency(totalRent)}/mo</p>
          )}
        </div>
      </div>
    </div>
  );
}
