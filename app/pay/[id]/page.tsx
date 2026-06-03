import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayForm } from "@/components/pay-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CheckCircle2, Clock, Home } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: rows } = await supabase.rpc("get_invoice_for_payment", { invoice_id: id });
  const invoice = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!invoice) notFound();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, status, approved_at, provider, phone, receipt_no")
    .eq("invoice_id", id)
    .order("submitted_at", { ascending: false });

  const approved = (payments ?? []).filter((p) => p.status === "approved");
  const pending  = (payments ?? []).filter((p) => p.status === "pending");
  const alreadyPaid = approved.reduce((s, p) => s + Number(p.amount), 0);
  const balance     = Math.max(0, Number(invoice.amount) - alreadyPaid);

  const isPaid     = balance <= 0;
  const hasPending = pending.length > 0;
  const lastReceipt = approved[0]?.receipt_no ?? null;
  const lastReceiptPaymentId = approved[0]?.id ?? null;

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-lg py-10 md:py-16">
        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: "var(--sidebar)" }}>
            <Home className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold leading-tight text-foreground">Mwenye</p>
            <p className="text-xs font-bold leading-tight text-foreground">Nyumba</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gradient-to-r from-primary/5 to-primary/10 p-6 md:p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Invoice · {invoice.period}</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              {isPaid ? "Receipt" : hasPending ? "Payment submitted" : alreadyPaid > 0 ? "Outstanding balance" : "Rent due"}
            </h1>
            {invoice.tenant_name && (
              <p className="mt-1 text-muted-foreground">
                For <span className="font-medium text-foreground">{invoice.tenant_name}</span>
                {invoice.property_name && <> · {invoice.property_name}</>}
                {invoice.tenant_unit && <> · Unit {invoice.tenant_unit}</>}
              </p>
            )}
          </div>

          <div className="grid gap-px bg-border md:grid-cols-2 [&>div]:bg-white">
            <div className="p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {isPaid ? "Total paid" : "Balance"}
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-figures">
                {formatCurrency(isPaid ? Number(invoice.amount) : balance)}
              </p>
              {!isPaid && alreadyPaid > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  of {formatCurrency(Number(invoice.amount))} ({formatCurrency(alreadyPaid)} paid)
                </p>
              )}
            </div>
            <div className="p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Due</p>
              <p className="mt-1 font-display text-3xl font-bold tabular-figures">{formatDate(invoice.due_date)}</p>
            </div>
          </div>

          <div className="p-6 md:p-8">
            {isPaid ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold">Payment confirmed</span>
                </div>
                <p className="mt-2 text-sm">
                  Paid in full across {approved.length} payment{approved.length !== 1 ? "s" : ""}.
                </p>
                {lastReceiptPaymentId && lastReceipt && (
                  <a href={`/api/receipts/${lastReceiptPaymentId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-emerald-700 underline">
                    Download receipt {lastReceipt}
                  </a>
                )}
              </div>
            ) : hasPending ? (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-center">
                <Clock className="mx-auto h-8 w-8 text-amber-500" />
                <p className="mt-3 font-semibold text-amber-900">Awaiting landlord approval</p>
                <p className="mt-1 text-sm text-amber-700">
                  Your payment of {formatCurrency(Number(pending[0].amount))} via {pending[0].provider} is being reviewed.
                </p>
              </div>
            ) : (
              <PayForm invoiceId={invoice.id} invoiceTotal={Number(invoice.amount)} alreadyPaid={alreadyPaid} />
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Secured by Mwenye Nyumba · Demo payment flow
        </p>
      </div>
    </main>
  );
}
