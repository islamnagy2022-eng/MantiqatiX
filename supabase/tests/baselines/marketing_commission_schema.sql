-- TEST-ONLY LIVE-DERIVED MARKETING SCHEMA COMPATIBILITY BASELINE
-- Source: read-only information_schema/pg_catalog snapshots from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NOT be applied to production.
-- Injected only into a fresh disposable replay before 20260927140500.
-- The later RC99 migration owns replacement of the three restrictive guards on
-- marketing_services and marketing_provider_services with the admin/owner policies.
-- No operational rows are inserted, copied, updated, or deleted.

CREATE TABLE public.marketing_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL,
  name_ar character varying NOT NULL,
  name_en character varying,
  category_code character varying,
  description text,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_services_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_services_code_key UNIQUE (code),
  CONSTRAINT marketing_services_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[]))
);
CREATE UNIQUE INDEX marketing_services_code_key ON public.marketing_services USING btree (code);
ALTER TABLE public.marketing_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_services FORCE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active marketing services" ON public.marketing_services FOR SELECT TO anon, authenticated USING ((status)::text = 'ACTIVE'::text);
CREATE POLICY authenticated_sessions_only ON public.marketing_services AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text);
CREATE POLICY mnt_non_anonymous_boundary ON public.marketing_services AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false)
  WITH CHECK (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false);
CREATE POLICY non_anonymous_authenticated_guard ON public.marketing_services AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text);
REVOKE ALL ON TABLE public.marketing_services FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketing_services TO anon, authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_services TO service_role;

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
  CONSTRAINT marketing_provider_services_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.marketing_provider_profiles(id) ON DELETE CASCADE,
  CONSTRAINT marketing_provider_services_provider_id_service_id_key UNIQUE (provider_id, service_id),
  CONSTRAINT marketing_provider_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.marketing_services(id) ON DELETE CASCADE,
  CONSTRAINT marketing_provider_services_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[]))
);
CREATE INDEX idx_mkt_provider_services_service ON public.marketing_provider_services USING btree (service_id);
CREATE UNIQUE INDEX marketing_provider_services_provider_id_service_id_key ON public.marketing_provider_services USING btree (provider_id, service_id);
ALTER TABLE public.marketing_provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_services FORCE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active provider services" ON public.marketing_provider_services FOR SELECT TO anon, authenticated USING ((status)::text = 'ACTIVE'::text);
CREATE POLICY authenticated_sessions_only ON public.marketing_provider_services AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text);
CREATE POLICY mnt_non_anonymous_boundary ON public.marketing_provider_services AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false)
  WITH CHECK (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false);
CREATE POLICY non_anonymous_authenticated_guard ON public.marketing_provider_services AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text);
REVOKE ALL ON TABLE public.marketing_provider_services FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketing_provider_services TO anon, authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_provider_services TO service_role;

CREATE TABLE public.marketing_commission_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider_kind character varying NOT NULL,
  service_id uuid,
  commission_type character varying NOT NULL DEFAULT 'PERCENTAGE'::character varying,
  commission_value numeric NOT NULL DEFAULT 0,
  min_project_value numeric,
  max_project_value numeric,
  status character varying NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_commission_rules_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_commission_rules_commission_type_check CHECK (commission_type::text = ANY (ARRAY['PERCENTAGE'::character varying, 'FIXED'::character varying]::text[])),
  CONSTRAINT marketing_commission_rules_commission_value_check CHECK (commission_value >= 0::numeric),
  CONSTRAINT marketing_commission_rules_provider_kind_check CHECK (provider_kind::text = ANY (ARRAY['OFFICIAL'::character varying, 'PARTNER_COMPANY'::character varying, 'FREELANCER'::character varying]::text[])),
  CONSTRAINT marketing_commission_rules_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.marketing_services(id) ON DELETE SET NULL,
  CONSTRAINT marketing_commission_rules_status_check CHECK (status::text = ANY (ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying]::text[]))
);
ALTER TABLE public.marketing_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_commission_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active commission rules" ON public.marketing_commission_rules FOR SELECT TO authenticated USING ((status)::text = 'ACTIVE'::text);
CREATE POLICY authenticated_sessions_only ON public.marketing_commission_rules AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text);
CREATE POLICY mnt_non_anonymous_boundary ON public.marketing_commission_rules AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false)
  WITH CHECK (COALESCE(((auth.jwt() ->> 'is_anonymous'::text))::boolean, false) = false);
CREATE POLICY non_anonymous_authenticated_guard ON public.marketing_commission_rules AS RESTRICTIVE FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text)
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'::text), 'false'::text) <> 'true'::text);
REVOKE ALL ON TABLE public.marketing_commission_rules FROM PUBLIC, anon, authenticated, service_role;
GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLE public.marketing_commission_rules TO service_role;
