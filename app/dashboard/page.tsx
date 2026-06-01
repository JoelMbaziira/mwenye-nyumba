import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Building2, Users, TrendingUp, ArrowRight, CheckCircle2, Wrench, UserPlus, Clock } from "lucide-react";
import { PendingPayments } from "@/components/pending-payments";
import { AddPropertyDialog } from "@/components/add-property-dialog";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const period = currentPeriod();
  const firstName = ((user.user_metadata?.full_name as string) || user.email || "").split(/\s|@/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [
    { data: properties },
    { data: units },
    { data: tenants },
    { data: invoices },
    { data: maintenance },
    { data: pending },
  ] = await Promise.all([
    supabase.from("properties").select("id, name, address, type, units(id,status,rent_amount,number)").eq("landlord_id", user.id),
    supabase.from("units").select("id, status, rent_amount").eq("landlord_id", user.id),
    supabase.from("tenants").select("id, name, created_at").eq("landlord_id", user.id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, amount, status, period, paid_at, paid_provider, tenant_id, tenants(name)").eq("landlord_id", user.id).order("paid_at", { ascending: false }),
    supabase.from("maintenance_requests").select("id, title, status, priority, created_at, properties(name)").eq("landlord_id", user.id).in("status", ["open","in_progress"]).order("created_at", { ascending: false }).limit(3),
    supabase.from("invoices").select("id, amount, paid_phone, paid_provider, paid_at, tenant_id, tenants(name), units(number, properties(name))").eq("landlord_id", user.id).eq("status", "pending").order("paid_at", { ascending: false }),
  ]);

  const thisMonthInvoices = (invoices ?? []).filter((i) => i.period === period);
  const collected = thisMonthInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const pendingAmount = (pending ?? []).reduce((s: number, i: any) => s + i.amount, 0);
  const totalUnits = (units ?? []).length;
  const occupiedUnits = (units ?? []).filter((u) => u.status === "occupied").length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const monthlyRent = (units ?? []).filter((u) => u.status === "occupied").reduce((s, u) => s + u.rent_amount, 0);

  // Build recent activity
  const recentPaid = (invoices ?? []).filter((i) => i.status === "paid" && i.paid_at).slice(0, 3).map((i: any) => ({
    type: "payment", label: `Rent received from ${i.tenants?.name ?? "—"}`, sub: `via ${i.paid_provider}`, time: i.paid_at, amount: i.amount,
  }));
  const recentMaintenance = (maintenance ?? []).slice(0, 2).map((m: any) => ({
    type: "maintenance", label: `Maintenance: ${m.title}`, sub: m.properties?.name ?? "", time: m.created_at,
  }));
  const recentTenants = (tenants ?? []).slice(0, 2).map((t: any) => ({
    type: "tenant", label: `New tenant: ${t.name}`, sub: "joined", time: t.created_at,
  }));
  const activity = [...recentPaid, ...recentMaintenance, ...recentTenants]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  // Progress for rent collection
  const totalExpected = thisMonthInvoices.reduce((s, i) => s + i.amount, 0);
  const collectionPct = totalExpected > 0 ? Math.round((collected / totalExpected) * 100) : 0;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {greeting}, {firstName} {hour < 12 ? "☀️" : "👋"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your properties today.</p>
        </div>
        <AddPropertyDialog />
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Total Properties" value={String(properties?.length ?? 0)} sub="All properties" color="green" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Tenants" value={String(tenants?.length ?? 0)} sub="Currently renting" color="blue" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Monthly Rent" value={formatCurrency(monthlyRent)} sub="Expected this month" color="emerald" />
        <OccupancyCard rate={occupancyRate} occupied={occupiedUnits} total={totalUnits} />
      </div>

      {/* Middle row */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Rent overview */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Rent Overview</h2>
            <span className="text-xs text-muted-foreground">{periodLabel(period)}</span>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Collected</p>
              <p className="font-display text-3xl font-bold tabular-figures text-foreground">{formatCurrency(collected)}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${collectionPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{collectionPct}% of expected rent</p>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending approval</p>
              <p className="font-display text-2xl font-bold tabular-figures text-amber-600">{formatCurrency(pendingAmount)}</p>
              <p className="text-xs text-muted-foreground">{(pending ?? []).length} payment{(pending ?? []).length !== 1 ? "s" : ""} awaiting review</p>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent Activity</h2>
            <Link href="/dashboard/tenants" className="flex items-center gap-1 text-xs text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet. Add a property to get started.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.sub}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {(a as any).amount && (
                      <p className="text-sm font-semibold text-emerald-600">{formatCurrency((a as any).amount)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo(a.time)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pending payments approval */}
      {(pending ?? []).length > 0 && (
        <PendingPayments rows={pending as any} />
      )}

      {/* Properties grid */}
      {(properties ?? []).length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Properties</h2>
            <Link href="/dashboard/properties" className="flex items-center gap-1 text-sm text-primary hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(properties ?? []).slice(0, 4).map((p: any) => (
              <MiniPropertyCard key={p.id} property={p} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(properties ?? []).length === 0 && (
        <div className="rounded-xl border-2 border-dashed bg-white/60 p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h3 className="mt-3 font-display text-xl font-semibold">Start by adding a property</h3>
          <p className="mt-1 text-sm text-muted-foreground">Properties → units → tenants. That&apos;s the flow.</p>
          <Link href="/dashboard/properties" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
            Add your first property <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { bg: string; icon: React.ReactNode }> = {
    payment:     { bg: "bg-emerald-100", icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
    maintenance: { bg: "bg-orange-100",  icon: <Wrench       className="h-4 w-4 text-orange-500"  /> },
    tenant:      { bg: "bg-blue-100",    icon: <UserPlus     className="h-4 w-4 text-blue-500"    /> },
  };
  const { bg, icon } = map[type] ?? map.payment;
  return <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${bg}`}>{icon}</div>;
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    green:   "bg-primary/10 text-primary",
    blue:    "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber:   "bg-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className={`mb-4 inline-flex rounded-lg p-2 ${colorMap[color]}`}>{icon}</div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-figures">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function OccupancyCard({ rate, occupied, total }: { rate: number; occupied: number; total: number }) {
  const circumference = 2 * Math.PI * 28;
  const offset = circumference * (1 - rate / 100);
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Occupancy Rate</p>
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div>
          <p className="font-display text-2xl font-bold">{rate}%</p>
          <p className="text-xs text-muted-foreground">{occupied}/{total} occupied</p>
        </div>
      </div>
    </div>
  );
}

function MiniPropertyCard({ property }: { property: any }) {
  const units: any[] = property.units ?? [];
  const occupied = units.filter((u: any) => u.status === "occupied").length;
  const rate = units.length > 0 ? Math.round((occupied / units.length) * 100) : 0;
  const GRADIENTS = [
    "from-emerald-800 to-emerald-600",
    "from-teal-800 to-teal-600",
    "from-green-800 to-green-600",
    "from-slate-700 to-slate-500",
  ];
  const grad = GRADIENTS[property.name.charCodeAt(0) % GRADIENTS.length];

  return (
    <Link href={`/dashboard/properties/${property.id}`} className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className={`relative h-28 bg-gradient-to-br ${grad} flex items-center justify-center`}>
        <Building2 className="h-10 w-10 text-white/40" />
        <div className={`absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold text-white ${rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500"}`}>
          {rate}%
        </div>
      </div>
      <div className="p-3">
        <p className="font-semibold leading-tight group-hover:text-primary transition-colors">{property.name}</p>
        {property.address && <p className="text-xs text-muted-foreground truncate">{property.address}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{units.length} unit{units.length !== 1 ? "s" : ""}</p>
      </div>
    </Link>
  );
}
