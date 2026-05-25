-- ============================================================================
-- Mwenye Nyumba — Supabase schema
-- ============================================================================
-- Run this in the Supabase SQL editor (Database → SQL Editor → New query).
-- It is safe to run more than once; everything is IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ---------- TABLES ----------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  unit text not null,
  rent_amount numeric(12,2) not null check (rent_amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists tenants_landlord_idx on public.tenants(landlord_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  period text not null,         -- e.g. "2026-05"
  due_date date not null,
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_at timestamptz,
  paid_phone text,
  paid_provider text,
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, period)
);

create index if not exists invoices_tenant_idx on public.invoices(tenant_id);
create index if not exists invoices_landlord_idx on public.invoices(landlord_id);

-- ---------- ROW LEVEL SECURITY ----------------------------------------------

alter table public.tenants enable row level security;
alter table public.invoices enable row level security;

-- Tenants: only the owning landlord can do anything
drop policy if exists "tenants owner all" on public.tenants;
create policy "tenants owner all"
  on public.tenants for all
  using (auth.uid() = landlord_id)
  with check (auth.uid() = landlord_id);

-- Invoices: only the owning landlord. PUBLIC payment access is provided via
-- SECURITY DEFINER functions below — not via RLS exposure.
drop policy if exists "invoices owner all" on public.invoices;
create policy "invoices owner all"
  on public.invoices for all
  using (auth.uid() = landlord_id)
  with check (auth.uid() = landlord_id);

-- ---------- PUBLIC PAYMENT FUNCTIONS (security definer) ---------------------
-- These functions let an anonymous user (a tenant clicking an emailed link)
-- view a single invoice and mark it paid, WITHOUT opening up RLS.

-- Returns a single invoice with limited tenant details, by invoice id.
create or replace function public.get_invoice_for_payment(invoice_id uuid)
returns table (
  id uuid,
  amount numeric,
  period text,
  due_date date,
  status text,
  paid_at timestamptz,
  paid_provider text,
  paid_phone text,
  tenant_name text,
  tenant_unit text
)
language sql
security definer
set search_path = public
as $$
  select i.id, i.amount, i.period, i.due_date, i.status, i.paid_at,
         i.paid_provider, i.paid_phone,
         t.name as tenant_name,
         t.unit as tenant_unit
    from public.invoices i
    join public.tenants t on t.id = i.tenant_id
   where i.id = invoice_id
   limit 1;
$$;

revoke all on function public.get_invoice_for_payment(uuid) from public;
grant execute on function public.get_invoice_for_payment(uuid) to anon, authenticated;

-- Marks an invoice paid if currently unpaid. Returns true on success.
create or replace function public.pay_invoice(
  invoice_id uuid,
  pay_phone text,
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
  if pay_provider not in ('MTN MoMo', 'Airtel Money', 'M-Pesa') then
    raise exception 'Invalid provider';
  end if;

  if pay_phone is null or length(regexp_replace(pay_phone, '\D', '', 'g')) < 9 then
    raise exception 'Invalid phone';
  end if;

  update public.invoices
     set status = 'paid',
         paid_at = now(),
         paid_phone = pay_phone,
         paid_provider = pay_provider
   where id = invoice_id
     and status = 'unpaid';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.pay_invoice(uuid, text, text) from public;
grant execute on function public.pay_invoice(uuid, text, text) to anon, authenticated;
