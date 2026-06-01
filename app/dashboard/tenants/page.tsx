import { createClient } from "@/lib/supabase/server";
import { TenantsTable } from "@/components/tenants-table";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export type TenantRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unit: { id: string; number: string; property: { id: string; name: string } | null } | null;
  rent_amount: number;
  latest_invoice: {
    id: string; amount: number; period: string; due_date: string;
    status: "paid" | "unpaid"; paid_at: string | null;
    paid_phone: string | null; paid_provider: string | null;
    last_reminder_sent_at: string | null;
  } | null;
};

export default async function TenantsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenants } = await supabase
    .from("tenants")
    .select(`
      id, name, email, phone,
      units(id, number, rent_amount, properties(id, name))
    `)
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: true });

  // Fetch latest invoice per tenant
  const tenantIds = (tenants ?? []).map((t) => t.id);
  const invoiceMap = new Map<string, TenantRow["latest_invoice"]>();

  if (tenantIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, tenant_id, amount, period, due_date, status, paid_at, paid_phone, paid_provider, last_reminder_sent_at, created_at")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });

    for (const inv of invoices ?? []) {
      if (!invoiceMap.has(inv.tenant_id)) {
        invoiceMap.set(inv.tenant_id, {
          id: inv.id, amount: inv.amount, period: inv.period, due_date: inv.due_date,
          status: inv.status, paid_at: inv.paid_at, paid_phone: inv.paid_phone,
          paid_provider: inv.paid_provider, last_reminder_sent_at: inv.last_reminder_sent_at,
        });
      }
    }
  }

  const rows: TenantRow[] = (tenants ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    phone: t.phone,
    unit: t.units ? {
      id: t.units.id,
      number: t.units.number,
      property: t.units.properties ?? null,
    } : null,
    rent_amount: t.units?.rent_amount ?? 0,
    latest_invoice: invoiceMap.get(t.id) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Renters</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Tenants</h1>
        </div>
        {rows.length > 0 && (
          <Badge variant="outline" className="font-mono">{rows.length} total</Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/40 p-12 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <h3 className="mt-3 font-display text-xl font-semibold">No tenants yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add units to your properties, then assign tenants to them.
          </p>
        </div>
      ) : (
        <TenantsTable rows={rows} />
      )}
    </div>
  );
}
