"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PendingPayments({ rows }: { rows: any[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handle(invoiceId: string, action: "approve" | "reject") {
    setLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      toast.success(action === "approve" ? "Payment approved ✓" : "Payment rejected — invoice reset to unpaid.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-amber-600" />
        <h2 className="font-semibold text-amber-900">Pending payment approvals</h2>
        <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
          {rows.length}
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((inv: any) => {
          const tenant = inv.tenants;
          const unit = inv.units;
          const property = unit?.properties;
          const isLoading = loadingId === inv.id;
          return (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                    {tenant?.name?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{tenant?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {property?.name ? `${property.name} · ` : ""}{unit?.number ? `Unit ${unit.number}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground text-sm">{formatCurrency(inv.amount)}</span>
                  {inv.paid_provider && <span>via {inv.paid_provider}</span>}
                  {inv.paid_phone && <span>{inv.paid_phone}</span>}
                  {inv.paid_at && <span>Submitted {formatDateTime(inv.paid_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isLoading}
                  onClick={() => handle(inv.id, "reject")}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={isLoading}
                  onClick={() => handle(inv.id, "approve")}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Approve
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
