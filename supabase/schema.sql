-- ============================================================================
-- Mwenye Nyumba — Supabase schema v2
-- ============================================================================
-- Run this in SQL Editor. Everything is IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ---------- PROPERTIES ------------------------------------------------------

create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  address     text,
  type        text not null default 'residential'
              check (type in ('residential','commercial','multifamily','mixed_use','land','industrial','short_term')),
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists properties_landlord_idx on public.properties(landlord_id);

-- ---------- UNITS ------------------------------------------------------------

create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  number      text not null,
  bedrooms    int,
  bathrooms   int,
  rent_amount numeric(12,2) not null check (rent_amount > 0),
  status      text not null default 'vacant'
              check (status in ('occupied','vacant')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (property_id, number)
);

create index if not exists units_property_idx on public.units(property_id);
create index if not exists units_landlord_idx on public.units(landlord_id);

-- ---------- TENANTS ----------------------------------------------------------

create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  landlord_id       uuid not null references auth.users(id) on delete cascade,
  unit_id           uuid references public.units(id) on delete set null,
  name              text not null,
  email             text not null,
  phone             text,
  national_id       text,
  emergency_contact text,
  notes             text,
  created_at        timestamptz not null default now(),
  constraint tenants_one_per_unit unique (unit_id)
);

create index if not exists tenants_landlord_idx on public.tenants(landlord_id);
create index if not exists tenants_unit_idx    on public.tenants(unit_id);

-- ---------- LEASES -----------------------------------------------------------

create table if not exists public.leases (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  unit_id        uuid not null references public.units(id) on delete cascade,
  landlord_id    uuid not null references auth.users(id) on delete cascade,
  rent_amount    numeric(12,2) not null check (rent_amount > 0),
  start_date     date not null,
  end_date       date,
  status         text not null default 'active'
                 check (status in ('active','expired','terminated')),
  deposit_amount numeric(12,2),
  deposit_paid   boolean default false,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists leases_tenant_idx on public.leases(tenant_id);
create index if not exists leases_unit_idx   on public.leases(unit_id);

-- ---------- INVOICES ---------------------------------------------------------

create table if not exists public.invoices (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  unit_id               uuid references public.units(id) on delete set null,
  landlord_id           uuid not null references auth.users(id) on delete cascade,
  lease_id              uuid references public.leases(id) on delete set null,
  amount                numeric(12,2) not null check (amount > 0),
  period                text not null,   -- "2026-05"
  due_date              date not null,
  status                text not null default 'unpaid'
                        check (status in ('unpaid','pending','paid')),
  paid_at               timestamptz,
  paid_phone            text,
  paid_provider         text,
  last_reminder_sent_at timestamptz,
  created_at            timestamptz not null default now(),
  unique (tenant_id, period)
);

create index if not exists invoices_tenant_idx   on public.invoices(tenant_id);
create index if not exists invoices_landlord_idx on public.invoices(landlord_id);

-- ---------- MAINTENANCE REQUESTS ---------------------------------------------

create table if not exists public.maintenance_requests (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references auth.users(id) on delete cascade,
  property_id   uuid references public.properties(id) on delete set null,
  unit_id       uuid references public.units(id) on delete set null,
  tenant_id     uuid references public.tenants(id) on delete set null,
  title         text not null,
  description   text,
  category      text not null default 'other'
                check (category in ('plumbing','electrical','hvac','structural','appliance','pest','cleaning','other')),
  priority      text not null default 'normal'
                check (priority in ('low','normal','high','urgent')),
  status        text not null default 'open'
                check (status in ('open','in_progress','resolved','closed')),
  estimated_cost numeric(12,2),
  actual_cost    numeric(12,2),
  notes          text,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists maintenance_landlord_idx on public.maintenance_requests(landlord_id);
create index if not exists maintenance_property_idx on public.maintenance_requests(property_id);

-- ---------- ROW LEVEL SECURITY -----------------------------------------------

alter table public.properties          enable row level security;
alter table public.units               enable row level security;
alter table public.tenants             enable row level security;
alter table public.leases              enable row level security;
alter table public.invoices            enable row level security;
alter table public.maintenance_requests enable row level security;

-- Properties
drop policy if exists "properties owner all" on public.properties;
create policy "properties owner all" on public.properties for all
  using (auth.uid() = landlord_id) with check (auth.uid() = landlord_id);

-- Units
drop policy if exists "units owner all" on public.units;
create policy "units owner all" on public.units for all
  using (auth.uid() = landlord_id) with check (auth.uid() = landlord_id);

-- Tenants
drop policy if exists "tenants owner all" on public.tenants;
create policy "tenants owner all" on public.tenants for all
  using (auth.uid() = landlord_id) with check (auth.uid() = landlord_id);

-- Leases
drop policy if exists "leases owner all" on public.leases;
create policy "leases owner all" on public.leases for all
  using (auth.uid() = landlord_id) with check (auth.uid() = landlord_id);

-- Invoices
drop policy if exists "invoices owner all" on public.invoices;
create policy "invoices owner all" on public.invoices for all
  using (auth.uid() = landlord_id) with check (auth.uid() = landlord_id);

-- Maintenance
drop policy if exists "maintenance owner all" on public.maintenance_requests;
create policy "maintenance owner all" on public.maintenance_requests for all
  using (auth.uid() = landlord_id) with check (auth.uid() = landlord_id);

-- ---------- PUBLIC PAYMENT RPCs (security definer) ---------------------------

create or replace function public.get_invoice_for_payment(invoice_id uuid)
returns table (
  id            uuid,
  amount        numeric,
  period        text,
  due_date      date,
  status        text,
  paid_at       timestamptz,
  paid_provider text,
  paid_phone    text,
  tenant_name   text,
  tenant_unit   text,
  property_name text
)
language sql
security definer
set search_path = public
as $$
  select
    i.id, i.amount, i.period, i.due_date, i.status, i.paid_at,
    i.paid_provider, i.paid_phone,
    t.name  as tenant_name,
    u.number as tenant_unit,
    p.name  as property_name
  from public.invoices i
  join public.tenants t    on t.id = i.tenant_id
  left join public.units u on u.id = i.unit_id
  left join public.properties p on p.id = u.property_id
  where i.id = invoice_id
  limit 1;
$$;

revoke all on function public.get_invoice_for_payment(uuid) from public;
grant execute on function public.get_invoice_for_payment(uuid) to anon, authenticated;

-- submit_payment: tenant submits → pending (awaiting landlord approval)
create or replace function public.pay_invoice(
  invoice_id   uuid,
  pay_phone    text,
  pay_provider text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  if pay_provider not in ('MTN MoMo','Airtel Money','M-Pesa','Visa','Mastercard') then
    raise exception 'Invalid provider';
  end if;

  if pay_phone is null or (
    left(pay_phone, 4) <> '****' and
    length(regexp_replace(pay_phone, '\D', '', 'g')) < 9
  ) then
    raise exception 'Invalid phone or card reference';
  end if;

  -- Sets to PENDING — landlord must approve before it becomes paid
  update public.invoices
     set status        = 'pending',
         paid_at       = now(),
         paid_phone    = pay_phone,
         paid_provider = pay_provider
   where id     = invoice_id
     and status = 'unpaid';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.pay_invoice(uuid, text, text) from public;
grant execute on function public.pay_invoice(uuid, text, text) to anon, authenticated;

-- approve_invoice: landlord approves → paid
create or replace function public.approve_invoice(invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare updated_count int;
begin
  update public.invoices set status = 'paid'
  where id = invoice_id and status = 'pending' and landlord_id = auth.uid();
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.approve_invoice(uuid) from public;
grant execute on function public.approve_invoice(uuid) to authenticated;

-- reject_invoice: landlord rejects → back to unpaid, clears payment info
create or replace function public.reject_invoice(invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare updated_count int;
begin
  update public.invoices
     set status = 'unpaid', paid_at = null, paid_phone = null, paid_provider = null
   where id = invoice_id and status = 'pending' and landlord_id = auth.uid();
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.reject_invoice(uuid) from public;
grant execute on function public.reject_invoice(uuid) to authenticated;
