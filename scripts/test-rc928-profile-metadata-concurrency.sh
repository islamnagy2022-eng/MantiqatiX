#!/usr/bin/env bash
set -euo pipefail

db_url="${1:?Usage: $0 <disposable-postgres-url>}"
tenant_id="MNTY-PLATFORM"
branch_id="MNTY-HOMEWARES-QADAM-ALSAAD-MAIN"
owner_id="f7914ac7-4b03-4456-afdd-e386f2ac6a5b"
business_id="$(psql "$db_url" -v ON_ERROR_STOP=1 -Atc "
  select id
    from public.businesses
   where tenant_id = '$tenant_id'
     and code = 'MNTY-HOMEWARES-QADAM-ALSAAD'
     and upper(status) = 'ACTIVE'
   limit 1
")"
test -n "$business_id"

# This is disposable CI data only. Create the exact owner membership/provider
# prerequisites needed by the real owner-scoped profile RPC.
psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
DO \$setup\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
     WHERE user_id = '$owner_id'::uuid
       AND tenant_id = '$tenant_id'
       AND business_id = '$business_id'::uuid
       AND branch_id IS NULL
       AND status = 'ACTIVE'
       AND upper(role) IN ('OWNER','BUSINESS_OWNER','ADMIN')
  ) THEN
    INSERT INTO public.user_memberships
      (id,user_id,tenant_id,business_id,branch_id,role,permissions,status)
    VALUES
      ('RC928-CONCURRENCY-OWNER','$owner_id','$tenant_id','$business_id',NULL,'OWNER','["*"]'::jsonb,'ACTIVE');
  END IF;
END
\$setup\$;

INSERT INTO public.marketing_provider_profiles
  (provider_kind,business_id,owner_user_id,name_ar,slug,status)
VALUES
  ('OFFICIAL','$business_id','$owner_id','RC928 Concurrency Owner',
   'rc928-concurrency-' || lower(replace(gen_random_uuid()::text,'-','')),'ACTIVE');
SQL

# The atomic profile RPC is callable by a confirmed authenticated owner only.
psql "$db_url" -v ON_ERROR_STOP=1 <<'SQL'
DO $acl$
DECLARE
  v_function regprocedure :=
    'public.upsert_catalog_business_profile_atomic_backend(character varying,uuid,character varying,text,text,text,text,text,text,text,text,text,text,boolean,jsonb)'::regprocedure;
BEGIN
  IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC928_AUTHENTICATED_EXECUTE_MISSING';
  END IF;
  IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'RC928_ANON_EXECUTE_MUST_BE_DENIED';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM pg_catalog.aclexplode((SELECT proacl FROM pg_catalog.pg_proc WHERE oid=v_function)) acl
     WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'
  ) THEN
    RAISE EXCEPTION 'RC928_PUBLIC_EXECUTE_MUST_BE_DENIED';
  END IF;
END
$acl$;
SQL

# Writer A takes the business row lock first, then writes the promotional gallery.
# Writer B starts while A holds the lock and writes a different metadata key. Once
# B resumes, it must merge against A's committed row, not a stale JSONB snapshot.
(
  psql "$db_url" -v ON_ERROR_STOP=1 \
    -v tenant_id="$tenant_id" -v business_id="$business_id" \
    -v branch_id="$branch_id" -v owner_id="$owner_id" <<'SQL'
BEGIN;
SELECT id FROM public.businesses WHERE id=:'business_id'::uuid FOR UPDATE;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated', 'is_anonymous', false)::text, true);
SET LOCAL ROLE authenticated;
SELECT pg_sleep(2);
SELECT public.upsert_catalog_business_profile_atomic_backend(
  :'tenant_id', :'business_id'::uuid, :'branch_id',
  'RC928 Concurrency A', 'writer A', '+201000000000',
  'RC928 Concurrency Street', 'Monufia', 'Berkat Al Sabaa', '',
  'Sun-Thu 9:00-17:00', '', '', false,
  jsonb_build_object('promotional_images', jsonb_build_array(
    'https://cdn.example.test/rc928-concurrent-a.webp',
    'https://cdn.example.test/rc928-concurrent-b.webp'
  ))
);
RESET ROLE;
COMMIT;
SQL
) &
writer_a_pid=$!

sleep 0.35

psql "$db_url" -v ON_ERROR_STOP=1 \
  -v tenant_id="$tenant_id" -v business_id="$business_id" \
  -v branch_id="$branch_id" -v owner_id="$owner_id" <<'SQL'
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'owner_id', true);
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated', 'is_anonymous', false)::text, true);
SET LOCAL ROLE authenticated;
SELECT public.upsert_catalog_business_profile_atomic_backend(
  :'tenant_id', :'business_id'::uuid, :'branch_id',
  'RC928 Concurrency B', 'writer B', '+201000000000',
  'RC928 Concurrency Street', 'Monufia', 'Berkat Al Sabaa', '',
  'Sun-Thu 9:00-17:00', '', '', false,
  jsonb_build_object('facebook_url', 'https://facebook.com/rc928-concurrent-owner')
);
RESET ROLE;
COMMIT;
SQL

wait "$writer_a_pid"

psql "$db_url" -v ON_ERROR_STOP=1 -v business_id="$business_id" <<'SQL'
SELECT set_config('rc928.test_business_id', :'business_id', false);
DO $verify$
DECLARE
  v_profile jsonb;
  v_business_id uuid := current_setting('rc928.test_business_id')::uuid;
BEGIN
  SELECT settings->'catalog_profile'
    INTO v_profile
    FROM public.businesses
   WHERE id = v_business_id;

  IF v_profile->'promotional_images' IS DISTINCT FROM
       '["https://cdn.example.test/rc928-concurrent-a.webp","https://cdn.example.test/rc928-concurrent-b.webp"]'::jsonb THEN
    RAISE EXCEPTION 'RC928_CONCURRENT_GALLERY_PATCH_LOST: %', v_profile;
  END IF;
  IF v_profile->>'facebook_url' IS DISTINCT FROM 'https://facebook.com/rc928-concurrent-owner' THEN
    RAISE EXCEPTION 'RC928_CONCURRENT_SOCIAL_PATCH_LOST: %', v_profile;
  END IF;
END
$verify$;
SQL

echo "RC928_ATOMIC_PROFILE_METADATA_CONCURRENCY=PASS"
