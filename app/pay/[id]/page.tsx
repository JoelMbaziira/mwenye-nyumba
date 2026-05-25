import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayForm } from "@/components/pay-form";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: rows } = await supabase.rpc("get_invoice_for_payment", {
    invoice_id: params.id,
  });
  const invoice = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!invoice) notFound();

  const tenant = { name: invoice.tenant_name, unit: invoice.tenant_unit };

  return (
    <main className="min-h-screen">
      <div className="container max-w-xl py-10 md:py-16">
        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="font-display text-lg font-semibold leading-none">m</span>
          </div>
          <span className="font-display text-base font-semibold">Mwenye Nyumba</span>
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          {/* Header */}
          <div className="border-b p-6 md:p-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Invoice · {invoice.period}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {invoice.status === "paid" ? "Receipt" : "Rent due"}
            </h1>
            {tenant.name && (
              <p className="mt-1 text-muted-foreground">
                For <span className="text-foreground">{tenant.name}</span> · {tenant.unit}
              </p>
            )}
          </div>

          {/* Amount block */}
          <div className="grid gap-px bg-border md:grid-cols-2 [&>div]:bg-card">
            <div className="p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Amount
              </div>
              <div className="mt-1 font-display text-3xl font-semibold tabular-figures">
                {formatCurrency(invoice.amount)}
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Due
              </div>
              <div className="mt-1 font-display text-3xl font-semibold tabular-figures">
                {formatDate(invoice.due_date)}
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="p-6 md:p-8">
            {invoice.status === "paid" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Payment received</span>
                </div>
                <p className="mt-2 text-sm">
                  {invoice.paid_at && (
                    <>Recorded {formatDateTime(invoice.paid_at)}</>
                  )}
                  {invoice.paid_provider && (
                    <> · via {invoice.paid_provider}</>
                  )}
                  {invoice.paid_phone && (
                    <> · {invoice.paid_phone}</>
                  )}
                </p>
              </div>
            ) : (
              <PayForm invoiceId={invoice.id} amount={invoice.amount} />
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This is a demo payment flow. No real money is moved.
        </p>
      </div>
    </main>
  );
}
