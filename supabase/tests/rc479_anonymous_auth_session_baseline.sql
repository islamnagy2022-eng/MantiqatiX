-- Disposable-only proof of the anonymous Auth SELECT gap after raw-anon RC479.
-- Run after fixture + historical RC479, before the forward restrictive policy.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  false
);
DO $baseline$
DECLARE visible_private_rows integer;
BEGIN
  SELECT count(*) INTO visible_private_rows
  FROM public.marketing_provider_profiles
  WHERE owner_user_id IS NOT NULL AND settings IS NOT NULL;
  IF visible_private_rows <> 1 THEN
    RAISE EXCEPTION 'RC479_ANONYMOUS_AUTH_BASELINE_NOT_REPRODUCED:%', visible_private_rows;
  END IF;
END
$baseline$;
RESET ROLE;
SELECT 'RC479 anonymous Auth residual reproduced before forward guard: PASS' AS result;
