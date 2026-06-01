"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, Bath, MoreHorizontal, UserPlus, Trash2, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AddTenantDialog } from "@/components/add-tenant-dialog";

export function UnitCard({ unit, propertyId }: { unit: any; propertyId: string }) {
  const router = useRouter();
  const tenant = Array.isArray(unit.tenants) ? unit.tenants[0] : unit.tenants;

  async function handleDeleteUnit() {
    if (!confirm(`Delete unit ${unit.number}? This will also remove any tenant assigned to it.`)) return;
    try {
      const res = await fetch(`/api/units/${unit.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success("Unit deleted.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not delete.");
    }
  }

  async function handleRemoveTenant() {
    if (!tenant) return;
    if (!confirm(`Remove ${tenant.name} from unit ${unit.number}?`)) return;
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success("Tenant removed.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not remove.");
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold">Unit {unit.number}</span>
            <Badge variant={unit.status === "occupied" ? "paid" : "outline"} className="text-xs">
              {unit.status === "occupied" ? "Occupied" : "Vacant"}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {unit.bedrooms != null && (
              <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {unit.bedrooms} bed</span>
            )}
            {unit.bathrooms != null && (
              <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {unit.bathrooms} bath</span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {tenant && (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleRemoveTenant}>
                <User className="h-4 w-4" /> Remove tenant
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDeleteUnit}>
              <Trash2 className="h-4 w-4" /> Delete unit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="mt-3 font-display text-xl font-semibold">{formatCurrency(unit.rent_amount)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>

      {unit.notes && <p className="mt-1 text-xs text-muted-foreground">{unit.notes}</p>}

      <div className="mt-3 border-t pt-3">
        {tenant ? (
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-bold">
              {tenant.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{tenant.name}</p>
              <p className="truncate text-xs text-muted-foreground">{tenant.email}</p>
            </div>
          </div>
        ) : (
          <AddTenantDialog unitId={unit.id} propertyId={propertyId} trigger={
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <UserPlus className="h-3.5 w-3.5" /> Add tenant
            </button>
          } />
        )}
      </div>
    </div>
  );
}
