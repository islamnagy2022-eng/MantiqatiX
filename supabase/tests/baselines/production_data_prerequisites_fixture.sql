\if :{?mantiqati_disposable}
  \if :mantiqati_disposable
    \echo 'Using explicit disposable-test authorization for production-checkpoint data prerequisites.'
  \else
    \echo 'REFUSED: this prerequisite fixture requires -v mantiqati_disposable=on.'
    \quit 3
  \endif
\else
  \echo 'REFUSED: set -v mantiqati_disposable=on only for an isolated disposable database.'
  \quit 3
\endif

-- The captured Production checkpoint is schema-only. Recreate only the minimal
-- pre-existing data dependency needed by the later Qadam catalog migration.
-- All values are deterministic test fixtures; no Production rows are read or copied.
BEGIN;

INSERT INTO public.tenants (id, name, code, status, settings)
VALUES (
  'MNTY-PLATFORM',
  'MNTY Platform',
  'MNTY',
  'ACTIVE',
  '{"test_fixture":true,"source":"FORWARD_MIGRATION_REPLAY_PREREQUISITE"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- The historical Qadam migration references this owner UUID. Use an isolated
-- synthetic auth.users row so its FK can be validated during replay.
INSERT INTO auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   is_sso_user, is_anonymous)
VALUES
  ('f7914ac7-4b03-4456-afdd-e386f2ac6a5b',
   'authenticated', 'authenticated',
   'qadam-migration-fixture@example.invalid', '',
   now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"test_fixture":true,"source":"FORWARD_MIGRATION_REPLAY_PREREQUISITE"}'::jsonb,
   now(), now(), false, false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
