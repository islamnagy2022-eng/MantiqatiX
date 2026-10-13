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


-- The following two related tables are included as disposable-only compatibility
-- dependencies because the same historical ALTER POLICY migration references them
-- before any canonical CREATE TABLE source is present in the repository.
-- Their shape/policies below are catalog-derived snapshots, not historical DDL.
-- The policy predicates and observed grants are preserved; no rows are copied.

CREATE TABLE public.marketing_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  client_business_id uuid,
  project_type character varying NOT NULL DEFAULT 'MARKETING_SERVICE'::character varying,
  management_mode character varying NOT NULL DEFAULT 'OFFICIAL'::character varying,
  status character varying NOT NULL DEFAULT 'OPEN'::character varying,
  gross_value numeric NOT NULL DEFAULT 0,
  platform_commission numeric NOT NULL DEFAULT 0,
  management_fee numeric NOT NULL DEFAULT 0,
  partner_payout numeric NOT NULL DEFAULT 0,
  currency character varying NOT NULL DEFAULT 'EGP'::character varying,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_projects_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_projects_client_business_id_fkey FOREIGN KEY (client_business_id) REFERENCES public.businesses(id) ON DELETE SET NULL,
  CONSTRAINT marketing_projects_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.marketing_leads(id) ON DELETE SET NULL,
  CONSTRAINT marketing_projects_gross_value_check CHECK (gross_value >= 0::numeric),
  CONSTRAINT marketing_projects_platform_commission_check CHECK (platform_commission >= 0::numeric),
  CONSTRAINT marketing_projects_management_fee_check CHECK (management_fee >= 0::numeric),
  CONSTRAINT marketing_projects_partner_payout_check CHECK (partner_payout >= 0::numeric),
  CONSTRAINT marketing_projects_management_mode_check CHECK (management_mode::text = ANY (ARRAY['OFFICIAL'::character varying,'PARTNER'::character varying,'JOINT'::character varying]::text[])),
  CONSTRAINT marketing_projects_status_check CHECK (status::text = ANY (ARRAY['OPEN'::character varying,'ACTIVE'::character varying,'ON_HOLD'::character varying,'COMPLETED'::character varying,'CANCELLED'::character varying]::text[]))
);
CREATE INDEX idx_mkt_projects_status ON public.marketing_projects USING btree (status, created_at DESC);
ALTER TABLE public.marketing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY "Project clients can view own marketing projects"
  ON public.marketing_projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = marketing_projects.client_business_id
        AND EXISTS (
          SELECT 1 FROM public.user_memberships um
          WHERE um.business_id = b.id
            AND um.user_id = (SELECT auth.uid() AS uid)
            AND um.status::text = 'ACTIVE'::text
        )
    )
  );
REVOKE ALL ON TABLE public.marketing_projects FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketing_projects TO authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_projects TO service_role;

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
  CONSTRAINT marketing_project_participants_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  CONSTRAINT marketing_project_participants_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketing_provider_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT marketing_project_participants_project_id_provider_id_role_key UNIQUE (project_id, provider_id, role),
  CONSTRAINT marketing_project_participants_agreed_value_check CHECK (agreed_value >= 0::numeric),
  CONSTRAINT marketing_project_participants_allocation_percent_check CHECK (allocation_percent >= 0::numeric AND allocation_percent <= 100::numeric),
  CONSTRAINT marketing_project_participants_role_check CHECK (role::text = ANY (ARRAY['MANAGER'::character varying,'EXECUTOR'::character varying,'SPECIALIST'::character varying,'REFERRER'::character varying]::text[])),
  CONSTRAINT marketing_project_participants_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying,'COMPLETED'::character varying,'REMOVED'::character varying]::text[]))
);
CREATE INDEX idx_mkt_project_participants_provider ON public.marketing_project_participants USING btree (provider_id);
ALTER TABLE public.marketing_project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_participants FORCE ROW LEVEL SECURITY;
CREATE POLICY "Providers view assigned projects"
  ON public.marketing_project_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketing_provider_profiles p
      WHERE p.id = marketing_project_participants.provider_id
        AND p.owner_user_id = (SELECT auth.uid() AS uid)
    )
  );
REVOKE ALL ON TABLE public.marketing_project_participants FROM PUBLIC, anon, authenticated, service_role;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_project_participants TO service_role;


-- Additional subscription-plan dependencies for the same historical policy migration.
-- These table definitions and policy predicates are read-only catalog snapshots dated
-- 2026-10-13. They are compatibility scaffolding for disposable replay, not recovered
-- historical DDL. The observed production grants are intentionally restrictive.

CREATE TABLE public.marketing_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_kind character varying NOT NULL,
  code character varying NOT NULL,
  name_ar character varying NOT NULL,
  name_en character varying,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency character varying NOT NULL DEFAULT 'EGP'::character varying,
  billing_period character varying NOT NULL DEFAULT 'MONTHLY'::character varying,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_plans_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_plans_provider_kind_code_key UNIQUE (provider_kind, code),
  CONSTRAINT marketing_plans_price_check CHECK (price >= 0::numeric),
  CONSTRAINT marketing_plans_billing_period_check CHECK (billing_period::text = ANY (ARRAY['MONTHLY'::character varying,'QUARTERLY'::character varying,'YEARLY'::character varying,'ONE_TIME'::character varying]::text[])),
  CONSTRAINT marketing_plans_provider_kind_check CHECK (provider_kind::text = ANY (ARRAY['OFFICIAL'::character varying,'PARTNER_COMPANY'::character varying,'FREELANCER'::character varying]::text[])),
  CONSTRAINT marketing_plans_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying,'INACTIVE'::character varying]::text[]))
);
ALTER TABLE public.marketing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active marketing plans"
  ON public.marketing_plans FOR SELECT TO anon, authenticated
  USING (status::text = 'ACTIVE'::text);
REVOKE ALL ON TABLE public.marketing_plans FROM PUBLIC, anon, authenticated, service_role;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_plans TO service_role;

CREATE TABLE public.marketing_provider_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_provider_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_provider_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.marketing_plans(id),
  CONSTRAINT marketing_provider_subscriptions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketing_provider_profiles(id) ON DELETE CASCADE,
  CONSTRAINT marketing_provider_subscriptions_status_check CHECK (status::text = ANY (ARRAY['TRIAL'::character varying,'ACTIVE'::character varying,'PAUSED'::character varying,'EXPIRED'::character varying,'CANCELLED'::character varying]::text[]))
);
ALTER TABLE public.marketing_provider_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their subscriptions"
  ON public.marketing_provider_subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketing_provider_profiles p
      WHERE p.id = marketing_provider_subscriptions.provider_id
        AND p.owner_user_id = (SELECT auth.uid() AS uid)
    )
  );
REVOKE ALL ON TABLE public.marketing_provider_subscriptions FROM PUBLIC, anon, authenticated, service_role;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_provider_subscriptions TO service_role;
