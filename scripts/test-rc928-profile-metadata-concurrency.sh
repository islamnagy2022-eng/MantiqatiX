#!/usr/bin/env bash
set -euo pipefail

db_url="$1"
if [[ -z "$db_url" ]]; then
  echo "Usage: $0 <disposable-postgres-url>" >&2
  exit 2
fi
tenant_id="MNTY-PLATFORM"
branch_id="MNTY-HOMEWARES-QADAM-ALSAAD-MAIN"
owner_id="f7914ac7-4b03-4456-afdd-e386f2ac6a5b"
business_id="$(psql "$db_url" -X -v ON_ERROR_STOP=1 -Atc "
  select id
    from public.businesses
   where tenant_id = '$tenant_id'
     and code = 'MNTY-HOMEWARES-QADAM-ALSAAD'
     and upper(status) = 'ACTIVE'
   limit 1
")"
test -n "$business_id"

# Fixture setup is restricted to the disposable PG17 replay database.
# Reuse existing active owner membership/provider records when present.
psql "$db_url" -X -v ON_ERROR_STOP=1 <<SQL
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
SELECT
  'OFFICIAL', '$business_id'::uuid, '$owner_id'::uuid, 'RC928 Concurrency Owner',
  'rc928-concurrency-' || lower(replace(gen_random_uuid()::text,'-','')), 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_provider_profiles
   WHERE business_id = '$business_id'::uuid AND upper(status) = 'ACTIVE'
);
SQL

# The authenticated role may execute the RPC; raw anon and PUBLIC may not.
psql "$db_url" -X -v ON_ERROR_STOP=1 <<'SQL'
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

# Writer A holds the business row lock, then writes the promotional gallery.
(
  PGAPPNAME=rc928_writer_a psql "$db_url" -X -v ON_ERROR_STOP=1 \
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

# Wait until PostgreSQL confirms writer A is in the sleep after taking the row lock.
writer_a_ready=0
for _attempt in $(seq 1 60); do
  writer_a_state="$(psql "$db_url" -X -v ON_ERROR_STOP=1 -Atc "
    select 1
      from pg_catalog.pg_stat_activity
     where application_name = 'rc928_writer_a'
       and state = 'active'
       and query ilike '%pg_sleep(2)%'
     limit 1
  " || true)"
  if [[ "$writer_a_state" == "1" ]]; then
    writer_a_ready=1
    break
  fi
  sleep 0.1
done
if [[ "$writer_a_ready" != "1" ]]; then
  kill "$writer_a_pid" 2>/dev/null || true
  wait "$writer_a_pid" 2>/dev/null || true
  echo "RC928_WRITER_A_DID_NOT_ACQUIRE_ROW_LOCK" >&2
  exit 1
fi

# Writer B attempts a different metadata patch while A still owns the row lock.
PGAPPNAME=rc928_writer_b psql "$db_url" -X -v ON_ERROR_STOP=1 \
  -v tenant_id="$tenant_id" -v business_id="$business_id" \
  -v branch_id="$branch_id" -v owner_id="$owner_id" <<'SQL' &
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
writer_b_pid=$!

# Prove writer B actually blocks on A's row lock before releasing A.
writer_b_waiting=0
for _attempt in $(seq 1 60); do
  writer_b_state="$(psql "$db_url" -X -v ON_ERROR_STOP=1 -Atc "
    select 1
      from pg_catalog.pg_stat_activity
     where application_name = 'rc928_writer_b'
       and wait_event_type = 'Lock'
     limit 1
  " || true)"
  if [[ "$writer_b_state" == "1" ]]; then
    writer_b_waiting=1
    break
  fi
  sleep 0.1
done
if [[ "$writer_b_waiting" != "1" ]]; then
  kill "$writer_b_pid" 2>/dev/null || true
  wait "$writer_b_pid" 2>/dev/null || true
  kill "$writer_a_pid" 2>/dev/null || true
  wait "$writer_a_pid" 2>/dev/null || true
  echo "RC928_WRITER_B_DID_NOT_WAIT_ON_ROW_LOCK" >&2
  exit 1
fi

wait "$writer_a_pid"
wait "$writer_b_pid"

psql "$db_url" -X -v ON_ERROR_STOP=1 -v business_id="$business_id" <<'SQL'
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
