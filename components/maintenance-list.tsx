"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { MaintenanceRow } from "@/app/dashboard/maintenance/page";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high:   "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-50 text-blue-700 border-blue-100",
  low:    "bg-secondary text-muted-foreground border-border",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  open:        <AlertCircle className="h-4 w-4 text-red-500" />,
  in_progress: <Clock className="h-4 w-4 text-amber-500" />,
  resolved:    <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  closed:      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

export function MaintenanceList({ rows }: { rows: MaintenanceRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success("Status updated.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not update.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this maintenance request?")) return;
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success("Request deleted.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not delete.");
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 shrink-0">{STATUS_ICON[row.status] ?? STATUS_ICON.open}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium leading-tight">{row.title}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLE[row.priority] ?? PRIORITY_STYLE.normal}`}>
                    {row.priority}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {row.category}
                  </span>
                </div>
                {row.description && <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {row.property && <span>{row.property.name}{row.unit ? ` · Unit ${row.unit.number}` : ""}</span>}
                  {row.tenant && <span>Reported by {row.tenant.name}</span>}
                  <span>{formatDate(row.created_at)}</span>
                  {row.estimated_cost && <span>Est. {formatCurrency(row.estimated_cost)}</span>}
                  {row.actual_cost && <span>Actual {formatCurrency(row.actual_cost)}</span>}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={loadingId === row.id}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.status === "open" && (
                  <DropdownMenuItem onClick={() => updateStatus(row.id, "in_progress")}>
                    <Clock className="h-4 w-4" /> Mark in progress
                  </DropdownMenuItem>
                )}
                {(row.status === "open" || row.status === "in_progress") && (
                  <DropdownMenuItem onClick={() => updateStatus(row.id, "resolved")}>
                    <CheckCircle2 className="h-4 w-4" /> Mark resolved
                  </DropdownMenuItem>
                )}
                {row.status === "resolved" && (
                  <DropdownMenuItem onClick={() => updateStatus(row.id, "open")}>
                    <AlertCircle className="h-4 w-4" /> Reopen
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(row.id)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
}
