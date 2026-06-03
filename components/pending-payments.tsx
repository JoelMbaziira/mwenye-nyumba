"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Loader2, FileText, Send, Mail } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PendingPayment {
  id: string;
  amount: number;
  provider: string;
  phone: string | null;
  submitted_at: string;
  invoice: {
    id: string;
    amount: number;
    period: string;
    tenant: { name: string | null; phone?: string | null; email?: string | null } | null;
    unit:   { number: string; properties: { name: string } | null } | null;
  } | null;
}

export function PendingPayments({ rows }: { rows: PendingPayment[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{
    paymentId: string; receiptNo: string; tenant?: string | null; phone?: string | null; email?: string | null;
  } | null>(null);

  async function approve(paymentId: string, row: PendingPayment) {
    setLoadingId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      toast.success(`Payment approved ✓  Receipt ${data.receipt_no} issued.`);
      setLastReceipt({
        paymentId,
        receiptNo: data.receipt_no,
        tenant: row.invoice?.tenant?.name,
        phone:  row.invoice?.tenant?.phone,
        email:  row.invoice?.tenant?.email,
      });
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingId(null);
    }
  }

  async function reject(paymentId: string) {
    setLoadingId(paymentId);
    try {
      const res = await fetch(`/api/payments/${paymentId}/reject`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      toast.success("Payment rejected.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingId(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <h2 className="font-semibold text-amber-900">Pending payment approvals</h2>
          <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
            {rows.length}
          </span>
        </div>
        <div className="space-y-3">
          {rows.map((p) => {
            const tenant = p.invoice?.tenant;
            const unit = p.invoice?.unit;
            const property = unit?.properties;
            const isLoading = loadingId === p.id;
            const isPartial = p.amount < (p.invoice?.amount ?? 0);
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-4">
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
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground text-sm">{formatCurrency(p.amount)}</span>
                    {isPartial && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Partial of {formatCurrency(p.invoice!.amount)}
                      </span>
                    )}
                    <span>via {p.provider}</span>
                    {p.phone && <span>{p.phone}</span>}
                    <span>Submitted {formatDateTime(p.submitted_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={isLoading}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => reject(p.id)}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject
                  </Button>
                  <Button size="sm" disabled={isLoading}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => approve(p.id, p)}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lastReceipt && (
        <ReceiptSharePanel
          paymentId={lastReceipt.paymentId} receiptNo={lastReceipt.receiptNo}
          tenant={lastReceipt.tenant} phone={lastReceipt.phone} email={lastReceipt.email}
          origin={origin} onClose={() => setLastReceipt(null)} />
      )}
    </div>
  );
}

function ReceiptSharePanel({
  paymentId, receiptNo, tenant, phone, email, origin, onClose,
}: {
  paymentId: string; receiptNo: string;
  tenant?: string | null; phone?: string | null; email?: string | null;
  origin: string; onClose: () => void;
}) {
  const url = `${origin}/api/receipts/${paymentId}`;
  const text = `Hi ${tenant ?? "there"}, here's your rent receipt ${receiptNo}: ${url}`;
  const whatsapp = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Receipt ${receiptNo}`)}&body=${encodeURIComponent(text)}`
    : null;

  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-emerald-700" />
        <h3 className="font-semibold text-emerald-900">Receipt {receiptNo} ready</h3>
        <button onClick={onClose} className="ml-auto text-xs text-emerald-700 hover:underline">Dismiss</button>
      </div>
      <p className="mt-1 text-sm text-emerald-800">Share it with {tenant ?? "the tenant"}:</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4" /> Open PDF
          </a>
        </Button>
        <Button size="sm" asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <Send className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
        {mailto && (
          <Button size="sm" variant="outline" asChild>
            <a href={mailto}>
              <Mail className="h-4 w-4" /> Email
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
