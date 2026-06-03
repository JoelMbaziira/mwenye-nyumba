-- ============================================================================
-- Mwenye Nyumba — schema migration v6
-- Adds partial payments + tenant credit balance + per-payment receipts.
--
-- New table: payments (one row per submitted contribution toward an invoice).
-- New column: tenants.credit_balance (auto-drained when new invoices appear).
-- Invoice status gains a 'partial' value: some approved, balance > 0.
-- New RPCs: submit_payment, approve_payment, reject_payment.
-- Old RPCs (pay_invoice, approve_invoice, reject_invoice) kept as thin
-- compatibility wrappers so the existing UI keeps working until cut over.
-- ============================================================================

-- ── tenants.credit_balance ──────────────────────────────────────────────────
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS credit_balance numeric(12,2) NOT NULL DEFAULT 0
    CHECK (credit_balance >= 0);

-- ── invoices: allow 'partial' status ────────────────────────────────────────
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('unpaid', 'partial', 'pending', 'paid'));

-- ── payments table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  landlord_id   uuid not null references auth.users(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  phone         text,
  provider      text not null
                check (provider in ('MTN MoMo','Airtel Money','M-Pesa','Visa','Mastercard','Cash','Credit')),
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  receipt_no    text unique,  -- assigned at approval time, e.g. "MN-2026-0001"
  submitted_at  timestamptz not null default now(),
  approved_at   timestamptz,
  rejected_at   timestamptz,
  note          text
);

CREATE INDEX IF NOT EXISTS payments_invoice_idx  ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_landlord_idx ON public.payments(landlord_id);
CREATE INDEX IF NOT EXISTS payments_status_idx   ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_landlord_select ON public.payments;
CREATE POLICY payments_landlord_select ON public.payments
  FOR SELECT TO authenticated
  USING (landlord_id = auth.uid());

DROP POLICY IF EXISTS payments_landlord_modify ON public.payments;
CREATE POLICY payments_landlord_modify ON public.payments
  FOR UPDATE TO authenticated
  USING (landlord_id = auth.uid());

-- ── Helper: recompute one invoice's status + total paid ─────────────────────
CREATE OR REPLACE FUNCTION public.recompute_invoice_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   numeric;
  v_paid    numeric;
  v_pending int;
  v_new     text;
BEGIN
  SELECT amount INTO v_total FROM public.invoices WHERE id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
   WHERE invoice_id = p_invoice_id AND status = 'approved';

  SELECT COUNT(*) INTO v_pending
    FROM public.payments
   WHERE invoice_id = p_invoice_id AND status = 'pending';

  IF v_paid >= v_total THEN
    v_new := 'paid';
  ELSIF v_pending > 0 THEN
    v_new := 'pending';
  ELSIF v_paid > 0 THEN
    v_new := 'partial';
  ELSE
    v_new := 'unpaid';
  END IF;

  UPDATE public.invoices
     SET status  = v_new,
         paid_at = CASE WHEN v_new = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END
   WHERE id = p_invoice_id;
END;
$$;

-- ── submit_payment: tenant submits any amount → pending ─────────────────────
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_invoice_id  uuid,
  p_amount      numeric,
  p_phone       text,
  p_provider    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv      record;
  v_paid     numeric;
  v_balance  numeric;
  v_payment_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_provider NOT IN ('MTN MoMo','Airtel Money','M-Pesa','Visa','Mastercard','Cash') THEN
    RAISE EXCEPTION 'Invalid provider';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'paid' THEN RAISE EXCEPTION 'Invoice is already fully paid'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
   WHERE invoice_id = p_invoice_id AND status IN ('approved','pending');

  v_balance := v_inv.amount - v_paid;
  -- We allow overpayment; the excess becomes credit on approval.

  INSERT INTO public.payments (invoice_id, tenant_id, landlord_id, amount, phone, provider, status)
  VALUES (p_invoice_id, v_inv.tenant_id, v_inv.landlord_id, p_amount, p_phone, p_provider, 'pending')
  RETURNING id INTO v_payment_id;

  PERFORM public.recompute_invoice_status(p_invoice_id);

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_payment(uuid, numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_payment(uuid, numeric, text, text) TO anon, authenticated;

-- ── approve_payment: landlord approves, assigns receipt#, banks any excess ──
CREATE OR REPLACE FUNCTION public.approve_payment(p_payment_id uuid)
RETURNS text  -- returns the assigned receipt number
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay      record;
  v_inv      record;
  v_paid     numeric;
  v_excess   numeric;
  v_receipt  text;
  v_year     text;
  v_seq      int;
BEGIN
  SELECT * INTO v_pay
    FROM public.payments
   WHERE id = p_payment_id
     AND status = 'pending'
     AND landlord_id = auth.uid();
  IF v_pay IS NULL THEN RAISE EXCEPTION 'Payment not found or already processed'; END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = v_pay.invoice_id;

  -- Generate receipt no: MN-YYYY-#### per landlord
  v_year := to_char(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO v_seq
    FROM public.payments
   WHERE landlord_id = auth.uid()
     AND status = 'approved'
     AND to_char(approved_at, 'YYYY') = v_year;
  v_receipt := 'MN-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  UPDATE public.payments
     SET status      = 'approved',
         approved_at = now(),
         receipt_no  = v_receipt
   WHERE id = p_payment_id;

  -- Handle overpayment: anything above invoice balance → tenant credit
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments
   WHERE invoice_id = v_inv.id AND status = 'approved';

  v_excess := v_paid - v_inv.amount;
  IF v_excess > 0 THEN
    UPDATE public.tenants
       SET credit_balance = credit_balance + v_excess
     WHERE id = v_inv.tenant_id;

    -- Cap the invoice's "paid" portion at its amount by inserting a negative
    -- balancing record. Cleaner: just store the credit and let the invoice
    -- show as fully paid. We do nothing to the payments themselves; the
    -- credit absorbs the difference for next invoice.
  END IF;

  PERFORM public.recompute_invoice_status(v_inv.id);

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_payment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_payment(uuid) TO authenticated;

-- ── reject_payment: landlord rejects a submission ───────────────────────────
CREATE OR REPLACE FUNCTION public.reject_payment(p_payment_id uuid, p_note text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_count      int;
BEGIN
  SELECT invoice_id INTO v_invoice_id
    FROM public.payments
   WHERE id = p_payment_id AND status = 'pending' AND landlord_id = auth.uid();
  IF v_invoice_id IS NULL THEN RETURN false; END IF;

  UPDATE public.payments
     SET status = 'rejected', rejected_at = now(), note = p_note
   WHERE id = p_payment_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.recompute_invoice_status(v_invoice_id);
  RETURN v_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_payment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reject_payment(uuid, text) TO authenticated;

-- ── Auto-apply tenant credit when a new invoice is created ──────────────────
CREATE OR REPLACE FUNCTION public.apply_credit_to_new_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit  numeric;
  v_use     numeric;
BEGIN
  SELECT credit_balance INTO v_credit FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_credit IS NULL OR v_credit <= 0 THEN RETURN NEW; END IF;

  v_use := LEAST(v_credit, NEW.amount);

  -- Record the credit as an approved payment so the receipt trail is complete
  INSERT INTO public.payments (invoice_id, tenant_id, landlord_id, amount, provider, status, approved_at, note, receipt_no)
  VALUES (NEW.id, NEW.tenant_id, NEW.landlord_id, v_use, 'Credit', 'approved', now(),
          'Auto-applied from tenant credit balance',
          'MN-CR-' || substr(NEW.id::text, 1, 8));

  UPDATE public.tenants SET credit_balance = credit_balance - v_use WHERE id = NEW.tenant_id;

  PERFORM public.recompute_invoice_status(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_credit_to_new_invoice ON public.invoices;
CREATE TRIGGER trg_apply_credit_to_new_invoice
  AFTER INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.apply_credit_to_new_invoice();

-- ── Compatibility wrappers — keep old RPCs working ──────────────────────────
-- pay_invoice now creates a full-amount payment via submit_payment.
CREATE OR REPLACE FUNCTION public.pay_invoice(
  invoice_id   uuid,
  pay_phone    text,
  pay_provider text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount numeric;
BEGIN
  SELECT (i.amount - COALESCE((
    SELECT SUM(amount) FROM public.payments
     WHERE invoice_id = i.id AND status IN ('approved','pending')
  ), 0))
  INTO v_amount
  FROM public.invoices i WHERE i.id = invoice_id;

  IF v_amount IS NULL OR v_amount <= 0 THEN RETURN false; END IF;

  PERFORM public.submit_payment(invoice_id, v_amount, pay_phone, pay_provider);
  RETURN true;
END;
$$;

-- approve_invoice now approves the latest pending payment on that invoice.
CREATE OR REPLACE FUNCTION public.approve_invoice(invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment uuid;
BEGIN
  SELECT id INTO v_payment
    FROM public.payments
   WHERE invoice_id = approve_invoice.invoice_id
     AND status = 'pending'
     AND landlord_id = auth.uid()
   ORDER BY submitted_at DESC LIMIT 1;
  IF v_payment IS NULL THEN RETURN false; END IF;

  PERFORM public.approve_payment(v_payment);
  RETURN true;
END;
$$;

-- reject_invoice rejects the latest pending payment on that invoice.
CREATE OR REPLACE FUNCTION public.reject_invoice(invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment uuid;
BEGIN
  SELECT id INTO v_payment
    FROM public.payments
   WHERE invoice_id = reject_invoice.invoice_id
     AND status = 'pending'
     AND landlord_id = auth.uid()
   ORDER BY submitted_at DESC LIMIT 1;
  IF v_payment IS NULL THEN RETURN false; END IF;

  RETURN public.reject_payment(v_payment, 'Rejected by landlord');
END;
$$;

REVOKE ALL ON FUNCTION public.pay_invoice(uuid, text, text)    FROM public;
REVOKE ALL ON FUNCTION public.approve_invoice(uuid)            FROM public;
REVOKE ALL ON FUNCTION public.reject_invoice(uuid)             FROM public;
GRANT EXECUTE ON FUNCTION public.pay_invoice(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_invoice(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_invoice(uuid)          TO authenticated;

-- ── Helper to fetch a user's display name from auth.users (RLS-safe) ────────
CREATE OR REPLACE FUNCTION public.get_user_display_name(uid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    email,
    'Landlord'
  )
  FROM auth.users WHERE id = uid;
$$;
REVOKE ALL ON FUNCTION public.get_user_display_name(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(uuid) TO authenticated, anon;
