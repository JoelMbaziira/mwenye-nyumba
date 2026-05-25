import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TenantsTable } from "@/components/tenants-table";
import { AddTenantDialog } from "@/components/add-tenant-dialog";
import { Wallet, Users, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export type TenantWithInvoice = {
  id: string;
  name: string;
  email: string;
  unit: string;
  rent_amount: number;
  latest_invoice: {
    id: string;
    amount: number;
    period: string;
    due_date: string;
    status: "paid" | "unpaid";
    paid_at: string | null;
    paid_phone: string | null;
    paid_provider: string | null;
    last_reminder_sent_at: string | null;
  } | null;
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, email, unit, rent_amount")
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: true });

  // For each tenant, fetch their most recent invoice.
  const tenantIds = (tenants ?? []).map((t) => t.id);
  let invoicesByTenant = new Map<string, TenantWithInvoice["latest_invoice"]>();
  if (tenantIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "id, tenant_id, amount, period, due_date, status, paid_at, paid_phone, paid_provider, last_reminder_sent_at, created_at"
      )
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });

    for (const inv of invoices ?? []) {
      if (!invoicesByTenant.has(inv.tenant_id)) {
        invoicesByTenant.set(inv.tenant_id, {
          id: inv.id,
          amount: inv.amount,
          period: inv.period,
          due_date: inv.due_date,
          status: inv.status,
          paid_at: inv.paid_at,
          paid_phone: inv.paid_phone,
          paid_provider: inv.paid_provider,
          last_reminder_sent_at: inv.last_reminder_sent_at,
        });
      }
    }
  }

  const rows: TenantWithInvoice[] = (tenants ?? []).map((t) => ({
    ...t,
    latest_invoice: invoicesByTenant.get(t.id) ?? null,
  }));

  const totalTenants = rows.length;
  const paidCount = rows.filter((r) => r.latest_invoice?.status === "paid").length;
  const unpaidCount = rows.filter((r) => r.latest_invoice && r.latest_invoice.status === "unpaid").length;
  const collected = rows
    .filter((r) => r.latest_invoice?.status === "paid")
    .reduce((sum, r) => sum + (r.latest_invoice?.amount ?? 0), 0);
  const outstanding = rows
    .filter((r) => r.latest_invoice?.status === "unpaid")
    .reduce((sum, r) => sum + (r.latest_invoice?.amount ?? 0), 0);

  return (
    <div className="space-y-10">
      {/* Greeting + add */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Dashboard
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Today&apos;s ledger
          </h1>
          <p className="mt-2 text-muted-foreground">
            Tenants, invoices, and who&apos;s paid up.
          </p>
        </div>
        <AddTenantDialog />
      </div>

      {/* Summary */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Tenants"
          value={String(totalTenants)}
          sub={`${paidCount} paid · ${unpaidCount} outstanding`}
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label="Collected this cycle"
          value={formatCurrency(collected)}
          sub={paidCount > 0 ? `from ${paidCount} ${paidCount === 1 ? "payment" : "payments"}` : "no payments yet"}
          accent
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Outstanding"
          value={formatCurrency(outstanding)}
          sub={unpaidCount > 0 ? `${unpaidCount} ${unpaidCount === 1 ? "invoice" : "invoices"} unpaid` : "all clear"}
        />
      </section>

      {/* Tenants table */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Tenants</h2>
          {totalTenants > 0 && (
            <Badge variant="outline" className="font-mono">
              {totalTenants} total
            </Badge>
          )}
        </div>
        <TenantsTable rows={rows} />
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={`grid h-7 w-7 place-items-center rounded ${accent ? "bg-accent/15" : "bg-secondary"}`}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-4 font-display text-3xl font-semibold tabular-figures">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}
