-- RC480: expose only the fields used by the public published-page renderer.
-- Authenticated page owners and the trusted backend keep their existing grants.
-- No RLS policy, row, Auth, or application ownership rule is changed.
BEGIN;
REVOKE SELECT ON TABLE public.digital_pages FROM anon;
GRANT SELECT (
  id,
  page_type,
  slug,
  title,
  subtitle,
  description,
  seo_title,
  seo_description,
  status,
  version
) ON TABLE public.digital_pages TO anon;
COMMIT;
