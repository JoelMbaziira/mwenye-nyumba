-- ============================================================================
-- Mwenye Nyumba — schema migration v4
-- Adds an optional `floor` column to units so the grid numbering scheme
-- (1A, 2A, …) can be stored and sorted by level. Run in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS floor int;

CREATE INDEX IF NOT EXISTS units_floor_idx
  ON public.units (property_id, floor);
