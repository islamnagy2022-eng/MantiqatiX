-- TEST-ONLY SYNTHETIC ORGANIZATION SEED FOR DISPOSABLE MIGRATION REPLAY
-- The production schema capture is schema-only and intentionally contains no rows.
-- This deterministic organization satisfies the existing RC339 showcase seed dependency.
-- NEVER apply this file to production. It contains no production data and creates no auth user.

INSERT INTO public.organizations (id, tenant_id, name, code, status, settings)
SELECT 'MNTY-MAIN', 'MNTY-PLATFORM', 'MantiqatiX Main Organization (disposable replay fixture)', 'MNTY-MAIN', 'ACTIVE', '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organizations
  WHERE id = 'MNTY-MAIN'
);
