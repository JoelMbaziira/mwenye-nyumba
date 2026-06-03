-- ============================================================================
-- Mwenye Nyumba — schema migration v7 (CLEANUP)
--
-- This migration cleans up legacy fields, fixes the "null value in column"
-- error when adding a tenant, and removes orphan data from failed tests.
--
-- READ BEFORE RUNNING:
--   • This DROPS the legacy `tenants.unit` text column and the redundant
--     `tenants.rent_amount` column. Both are leftovers from an earlier
--     schema. The data they hold is duplicated elsewhere (unit_id → units,
--     and unit.rent_amount holds the canonical rent).
--   • If your app still reads tenants.unit anywhere, that read will break.
--     Search your code for `\.unit\b` references on tenant rows before
--     running. Most likely there are none; the schema has moved past it.
--   • A unit-status reset cleans up orphan "occupied" units left behind by
--     failed tenant-creation attempts.
--   • Safe to run twice (uses IF EXISTS / IF NOT EXISTS).
-- ============================================================================

-- ── 1. Drop legacy text columns from tenants ────────────────────────────────
-- The tenants.unit text column was replaced by tenants.unit_id (uuid → units).
-- It is still NOT NULL, which is why adding a tenant now fails when the form
-- doesn't send it.
ALTER TABLE public.tenants DROP COLUMN IF EXISTS unit;

-- tenants.rent_amount duplicates units.rent_amount. The unit holds the rent.
ALTER TABLE public.tenants DROP COLUMN IF EXISTS rent_amount;

-- Make email optional. Many tenants don't have one; phone is enough.
ALTER TABLE public.tenants ALTER COLUMN email DROP NOT NULL;

-- unit_id should be required now that unit (text) is gone.
-- (Only enforce if every existing tenant already has a unit_id; otherwise
-- this would fail. Comment out if you have legacy rows with NULL unit_id.)
-- ALTER TABLE public.tenants ALTER COLUMN unit_id SET NOT NULL;

-- ── 2. Reset orphan "occupied" units ────────────────────────────────────────
-- Any unit marked occupied with no matching tenant goes back to vacant.
UPDATE public.units
   SET status = 'vacant'
 WHERE status = 'occupied'
   AND id NOT IN (
     SELECT unit_id FROM public.tenants WHERE unit_id IS NOT NULL
   );

-- ── 3. Wipe stale draft data (optional — uncomment if you want a fresh slate)
-- This deletes ALL tenants, leases, invoices, and resets ALL units to vacant
-- for the currently-logged-in landlord only. Use during development; remove
-- in production.
--
-- DO $$
-- DECLARE
--   uid uuid := auth.uid();
-- BEGIN
--   IF uid IS NULL THEN RAISE EXCEPTION 'Run this from an authenticated session.'; END IF;
--   DELETE FROM public.invoices WHERE landlord_id = uid;
--   DELETE FROM public.leases   WHERE landlord_id = uid;
--   DELETE FROM public.tenants  WHERE landlord_id = uid;
--   UPDATE public.units SET status = 'vacant' WHERE landlord_id = uid;
-- END $$;

-- ── 4. Transactional tenant creation ────────────────────────────────────────
-- A single RPC that creates a tenant AND flips the unit to occupied in one
-- atomic step. Either both succeed or both roll back. This prevents the
-- "ghost occupied unit" problem entirely going forward.
CREATE OR REPLACE FUNCTION public.create_tenant(
  p_name              text,
  p_phone             text,
  p_email             text,
  p_unit_id           uuid,
  p_national_id       text DEFAULT NULL,
  p_emergency_contact text DEFAULT NULL,
  p_notes             text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit       record;
  v_uid        uuid := auth.uid();
  v_tenant_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Tenant name is required';
  END IF;
  IF p_unit_id IS NULL THEN
    RAISE EXCEPTION 'Pick a unit for this tenant';
  END IF;

  -- Make sure the unit belongs to this landlord and is vacant
  SELECT * INTO v_unit FROM public.units
    WHERE id = p_unit_id AND landlord_id = v_uid;
  IF v_unit IS NULL THEN
    RAISE EXCEPTION 'Unit not found or does not belong to you';
  END IF;
  IF v_unit.status = 'occupied' THEN
    RAISE EXCEPTION 'That unit is already occupied';
  END IF;

  INSERT INTO public.tenants (
    landlord_id, name, phone, email, unit_id,
    national_id, emergency_contact, notes
  ) VALUES (
    v_uid, trim(p_name), p_phone, p_email, p_unit_id,
    p_national_id, p_emergency_contact, p_notes
  ) RETURNING id INTO v_tenant_id;

  UPDATE public.units SET status = 'occupied' WHERE id = p_unit_id;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant(text, text, text, uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_tenant(text, text, text, uuid, text, text, text) TO authenticated;

-- ── 5. Matching delete_tenant that frees the unit ───────────────────────────
CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
BEGIN
  SELECT unit_id INTO v_unit_id
    FROM public.tenants
   WHERE id = p_tenant_id AND landlord_id = auth.uid();
  IF v_unit_id IS NULL AND NOT FOUND THEN RETURN false; END IF;

  DELETE FROM public.tenants WHERE id = p_tenant_id AND landlord_id = auth.uid();

  IF v_unit_id IS NOT NULL THEN
    UPDATE public.units SET status = 'vacant'
     WHERE id = v_unit_id
       AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE unit_id = v_unit_id);
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tenant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_tenant(uuid) TO authenticated;
