-- TEST-ONLY SYNTHETIC TENANT SEED FOR DISPOSABLE MIGRATION REPLAY
-- The production schema capture is schema-only and intentionally contains no rows.
-- This deterministic platform tenant satisfies the existing RC test-business seed dependency.
-- NEVER apply this file to production. It contains no production data and creates no auth user.

INSERT INTO public.tenants (id, name, code, status, settings)
SELECT 'MNTY-PLATFORM', 'MantiqatiX Platform (disposable replay fixture)', 'MNTY-PLATFORM', 'ACTIVE', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tenants
  WHERE id = 'MNTY-PLATFORM'
);
