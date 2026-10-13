-- TEST-ONLY LIVE-DERIVED MARKETING PROJECT PARTICIPANTS COMPATIBILITY BASELINE
-- Captured from read-only catalog inspection of Supabase project moyhiluyhjsujhwlyeuu on 2026-10-13.
-- This is NOT recovered historical DDL and MUST NOT be applied to production.
-- It exists only as a temporary schema/policy fixture copied into disposable migration-replay CI.
-- No production rows, grants, secrets, or provider credentials are included.

CREATE TABLE public.marketing_project_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  role character varying NOT NULL,
  allocation_percent numeric,
  agreed_value numeric NOT NULL DEFAULT 0,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_project_participants_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_project_participants_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  CONSTRAINT marketing_project_participants_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.marketing_provider_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT marketing_project_participants_project_id_provider_id_role_key
    UNIQUE (project_id, provider_id, role),
  CONSTRAINT marketing_project_participants_agreed_value_check
    CHECK (agreed_value >= 0),
  CONSTRAINT marketing_project_participants_allocation_percent_check
    CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  CONSTRAINT marketing_project_participants_role_check
    CHECK (role::text = ANY (ARRAY['MANAGER'::character varying, 'EXECUTOR'::character varying, 'SPECIALIST'::character varying, 'REFERRER'::character varying]::text[])),
  CONSTRAINT marketing_project_participants_status_check
    CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'COMPLETED'::character varying, 'REMOVED'::character varying]::text[]))
);

CREATE INDEX idx_mkt_project_participants_provider
  ON public.marketing_project_participants USING btree (provider_id);

ALTER TABLE public.marketing_project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_participants FORCE ROW LEVEL SECURITY;

-- Reconstructed only as a disposable compatibility fixture from the current catalog policy.
-- PUBLIC is used here because the following historical migration explicitly changes this policy to authenticated.
CREATE POLICY "Providers view assigned projects"
  ON public.marketing_project_participants
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.marketing_provider_profiles p
      WHERE p.id = marketing_project_participants.provider_id
        AND p.owner_user_id = (SELECT auth.uid() AS uid)
    )
  );
