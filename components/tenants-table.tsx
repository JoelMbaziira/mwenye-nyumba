"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Send, Pencil, Trash2, Loader2 } from "lucide-react";

import type { TenantWithInvoice } from "@/app/dashboard/page";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { EditTenantDialog } from "@/components/edit-tenant-dialog";

export function TenantsTable({ rows }: { rows: TenantWithInvoice[] }) {
  const router = useRouter();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TenantWithInvoice | null>(null);

  async function handleSendReminder(tenantId: string) {
    setSendingId(tenantId);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success("Reminder sent.", {
        description: `Invoice emailed for ${data.period}.`,
      });
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not send reminder.");
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(tenantId: string, name: string) {
    if (!confirm(`Remove ${name}? Their invoices will also be deleted.`)) return;
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Tenant removed.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not delete.");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
        <h3 className="font-display text-xl font-semibold">No tenants yet</h3>
        <p className="mt-2 text-muted-foreground">
          Add your first tenant to start sending reminders.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid / Reminded</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const inv = row.latest_invoice;
              const status = inv?.status ?? "none";
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.unit}</TableCell>
                  <TableCell className="text-right tabular-figures">
                    {formatCurrency(row.rent_amount)}
                  </TableCell>
                  <TableCell>
                    {status === "paid" ? (
                      <Badge variant="paid">Paid</Badge>
                    ) : status === "unpaid" ? (
                      <Badge variant="unpaid">Unpaid</Badge>
                    ) : (
                      <Badge variant="outline">No invoice</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv?.status === "paid" && inv.paid_at ? (
                      <span title={`via ${inv.paid_provider} · ${inv.paid_phone}`}>
                        {formatDateTime(inv.paid_at)}
                      </span>
                    ) : inv?.last_reminder_sent_at ? (
                      <span>Reminded {formatDate(inv.last_reminder_sent_at)}</span>
                    ) : inv ? (
                      <span>Invoice generated</span>
                    ) : (
                      <span className="text-muted-foreground/70">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleSendReminder(row.id)}
                          disabled={sendingId === row.id}
                        >
                          {sendingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {inv && inv.status === "unpaid" ? "Resend reminder" : "Send reminder"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(row)}>
                          <Pencil className="h-4 w-4" />
                          Edit tenant
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(row.id, row.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditTenantDialog
          tenant={editing}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </>
  );
}
