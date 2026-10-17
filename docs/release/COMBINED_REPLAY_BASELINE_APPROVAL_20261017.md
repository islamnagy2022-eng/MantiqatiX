# Combined Disposable Replay Baseline — Explicit Approval Required

**Date:** 2026-10-17  
**Status:** PROPOSED ONLY — not implemented, not injected, not approved  
**Environment:** GitHub Actions disposable Supabase replay only  
**Production:** no changes authorized

## Why one combined decision is needed

The latest full replay [run 39011424756](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/39011424756) failed at the first missing historical relation, `public.marketing_provider_services`, before reaching the later known `MNTY-MAIN` organization dependency. Fixing only the table gap would cause a second replay run to stop at the missing organization row. This proposal groups both minimal fixtures so one approved replay run can test beyond both known blockers.

## Fixture A — live-derived marketing provider services table and public-read policy

Source: read-only production schema snapshot and catalog inspection. The original creation statement and public-active policy creation are absent from the applied migration ledger and tracked source.

Candidate SQL (for review only):

```sql
CREATE TABLE public.marketing_provider_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_id uuid NOT NULL,
  service_description text,
  pricing_from numeric,
  pricing_to numeric,
  currency character varying NOT NULL DEFAULT 'EGP'::character varying,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_provider_services_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_provider_services_provider_id_service_id_key UNIQUE (provider_id, service_id),
  CONSTRAINT marketing_provider_services_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.marketing_provider_profiles(id) ON DELETE CASCADE,
  CONSTRAINT marketing_provider_services_service_id_fkey
    FOREIGN KEY (service_id) REFERENCES public.marketing_services(id) ON DELETE CASCADE,
  CONSTRAINT marketing_provider_services_status_check
    CHECK ((status)::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[]))
);

ALTER TABLE public.marketing_provider_services OWNER TO postgres;
ALTER TABLE public.marketing_provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_services FORCE ROW LEVEL SECURITY;

CREATE INDEX idx_mkt_provider_services_service
  ON public.marketing_provider_services USING btree (service_id);

CREATE POLICY "Public can view active provider services"
  ON public.marketing_provider_services
  FOR SELECT TO anon, authenticated
  USING ((status)::text = 'ACTIVE'::text);
```

Do **not** include grants, provider/service rows, secrets, or the `marketing_provider_services_owner_manage` policy. The chronological grant migration and RC99 owner-management policy migration must still execute and be validated.

Proposed injected filename: `20260927131557_test_only_live_derived_marketing_provider_services.sql`, after the existing provider-profile baseline and before the recovered grant migration.

## Fixture B — minimum MNTY-MAIN organization row

Source: read-only production row from `public.organizations`:

- id `MNTY-MAIN`
- tenant_id `MNTY-PLATFORM`
- name `MNTY Main Organization`
- code `MNTY-ORG`
- status `ACTIVE`
- settings `{"bootstrap":"2026-09-27"}`

Candidate SQL (for review only):

```sql
INSERT INTO public.organizations (id, tenant_id, name, code, status, settings)
VALUES (
  'MNTY-MAIN',
  'MNTY-PLATFORM',
  'MNTY Main Organization',
  'MNTY-ORG',
  'ACTIVE',
  '{"bootstrap":"2026-09-27"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
```

Do **not** create any Auth user, user membership, platform-admin membership, or owner email in this fixture. The original applied bootstrap migration at ledger version `20260927131555` also creates owner membership and embeds an owner email; its exact source is not copied to the public repository pending privacy review.

Proposed injected filename: `20260927131556_test_only_live_derived_mnty_main_organization.sql`. The `ON CONFLICT DO NOTHING` clause makes this test-only seed safe if the original bootstrap source is later recovered and restored before it.

## Isolation and verification controls

If approved, implementation must:

1. Place both fixtures only under `supabase/tests/baselines/`; never place them under `supabase/migrations/`.
2. Add explicit fail-closed validation requiring the exact approval marker and pinned SHA-256 for both files.
3. Inject them only into the disposable replay workspace, with exact version prefixes above, and assert the target is a newly created disposable Supabase database.
4. Ensure neither fixture is tracked as a production migration, bundled for deployment, or applied by `supabase db push`.
5. Keep the run label `BASELINE_ASSISTED_CHRONOLOGICAL_REPLAY`; do not call it an authentic clean reconstruction from original migration sources.
6. Keep the original source-provenance blockers open even if the replay passes. The table creation/policy are live-derived, and the owner bootstrap migration remains unrecovered in public source.

## Approval needed

Approve both fixtures together for disposable CI only, or reject and provide a trusted source artifact / privacy-reviewed recovery path. No fixture or workflow injection has been added yet. No production action is authorized by this proposal.

Production release remains **BLOCKED / NOT CERTIFIED**.
