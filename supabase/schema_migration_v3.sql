-- ============================================================================
-- Mwenye Nyumba — schema migration v3
-- Replaces the mixed-use/commercial/industrial/land type enum with a
-- residential-first taxonomy. Run in Supabase SQL Editor.
-- ============================================================================

-- 1. Drop the old CHECK constraint and add the new one.
--    Supabase uses ALTER TABLE … DROP CONSTRAINT / ADD CONSTRAINT.
--    The constraint name was auto-generated; find it first:
--
--      SELECT conname FROM pg_constraint
--      WHERE conrelid = 'public.properties'::regclass AND contype = 'c';
--
--    Then replace <old_constraint_name> below with the actual name, e.g.
--    "properties_type_check".

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_type_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_type_check
  CHECK (type IN (
    -- Single-family subtypes
    'bungalow',
    'villa',
    'standalone',
    'townhouse',
    'maisonette',
    -- Multi-family subtypes
    'apartment_block',
    'condominium',
    'duplex',
    'triplex',
    'bedsitters',
    -- Specialized subtypes
    'studio',
    'servant_quarters',
    'guest_house',
    'hostel',
    -- Category-level fallbacks (when user picks category but no subtype)
    'single_family',
    'multi_family',
    'specialized'
  ));

-- 2. Update the default to 'standalone' (closest to old 'residential').
ALTER TABLE public.properties
  ALTER COLUMN type SET DEFAULT 'standalone';

-- 3. (Optional) Migrate any existing rows using old type values.
--    Adjust the mappings to match your data.
UPDATE public.properties SET type = 'standalone'     WHERE type = 'residential';
UPDATE public.properties SET type = 'apartment_block' WHERE type = 'multifamily';
UPDATE public.properties SET type = 'apartment_block' WHERE type = 'commercial';
UPDATE public.properties SET type = 'apartment_block' WHERE type = 'mixed_use';
UPDATE public.properties SET type = 'guest_house'     WHERE type = 'short_term';
-- 'industrial' and 'land' have no mapping — leave as-is or set a default:
UPDATE public.properties SET type = 'standalone'     WHERE type IN ('industrial', 'land');

-- 4. Add a generated/stored category column for easier querying
--    (optional convenience — lets you filter by top-level category without
--     repeating the CASE expression everywhere).
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS category text
  GENERATED ALWAYS AS (
    CASE type
      WHEN 'bungalow'        THEN 'single_family'
      WHEN 'villa'           THEN 'single_family'
      WHEN 'standalone'      THEN 'single_family'
      WHEN 'townhouse'       THEN 'single_family'
      WHEN 'maisonette'      THEN 'single_family'
      WHEN 'apartment_block' THEN 'multi_family'
      WHEN 'condominium'     THEN 'multi_family'
      WHEN 'duplex'          THEN 'multi_family'
      WHEN 'triplex'         THEN 'multi_family'
      WHEN 'bedsitters'      THEN 'multi_family'
      WHEN 'studio'          THEN 'specialized'
      WHEN 'servant_quarters' THEN 'specialized'
      WHEN 'guest_house'     THEN 'specialized'
      WHEN 'hostel'          THEN 'specialized'
      ELSE type  -- category-level fallback values pass through
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS properties_category_idx ON public.properties(category);
