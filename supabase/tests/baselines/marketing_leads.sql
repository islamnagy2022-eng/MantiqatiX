-- OWNER-APPROVED TEST-ONLY LIVE-DERIVED TABLE/POLICY BASELINE
-- Source: read-only information_schema, pg_catalog, pg_policies, and pg_indexes
-- from Supabase project moyhiluyhjsujhwlyeuu. Snapshot date: 2026-10-13.
-- This is NOT recovered historical DDL and MUST NOT be applied to production.
-- Injected only into a fresh disposable replay immediately before
-- 20260927140500_remove_anonymous_sensitive_policy_access_v2.sql.
-- Only the required owner-read policy is represented so the chronological ALTER POLICY
-- can execute. Later RC444/RC452 migrations remain the owners of CRM-manager/insert policy.
-- No operational rows are inserted, copied, updated, or deleted.

CREATE TABLE public.marketing_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_user_id uuid,
  requester_business_id uuid,
  title character varying NOT NULL,
  description text,
  budget_min numeric,
  budget_max numeric,
  currency character varying NOT NULL DEFAULT 'EGP'::character varying,
  required_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_area character varying,
  status character varying NOT NULL DEFAULT 'OPEN'::character varying,
  source character varying NOT NULL DEFAULT 'PLATFORM'::character varying,
  assigned_provider_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_leads_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_leads_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT marketing_leads_requester_business_id_fkey FOREIGN KEY (requester_business_id) REFERENCES public.businesses(id) ON DELETE SET NULL,
  CONSTRAINT marketing_leads_assigned_provider_id_fkey FOREIGN KEY (assigned_provider_id) REFERENCES public.marketing_provider_profiles(id) ON DELETE SET NULL,
  CONSTRAINT marketing_leads_status_check CHECK (status::text = ANY (ARRAY['OPEN'::character varying,'MATCHED'::character varying,'IN_PROGRESS'::character varying,'CLOSED'::character varying,'CANCELLED'::character varying]::text[])),
  CONSTRAINT marketing_leads_source_check CHECK (source::text = ANY (ARRAY['PLATFORM'::character varying,'OFFICIAL_MANTIQATIX'::character varying,'PARTNER_REFERRAL'::character varying,'OTHER'::character varying]::text[]))
);

CREATE INDEX idx_mkt_leads_status ON public.marketing_leads(status, created_at DESC);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_leads FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users view own marketing leads"
  ON public.marketing_leads
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = requester_user_id);
