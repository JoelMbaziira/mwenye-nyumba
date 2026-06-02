-- ============================================================================
-- Mwenye Nyumba — schema migration v5
-- Drops the rigid CHECK constraint on properties.type so the column can accept
-- any subtype the app chooses (hostel, bungalow, apartment_block, etc.).
-- Validation now lives in the application layer (components/add-property-dialog.tsx).
-- Run in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_type_check;
