-- RC480 disposable PostgreSQL fixture. Models public-page reads and the
-- existing authenticated/service-role table privileges without production data.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.digital_pages (
  id uuid PRIMARY KEY,
  page_type text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  seo_title text,
  seo_description text,
  theme jsonb,
  status text NOT NULL,
  version bigint NOT NULL,
  published_at timestamptz,
  business_id uuid,
  provider_profile_id uuid,
  digital_page_order_id uuid,
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.digital_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY digital_pages_public_read
  ON public.digital_pages
  FOR SELECT TO anon, authenticated
  USING (status = 'PUBLISHED');

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.digital_pages TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.digital_pages TO authenticated;

INSERT INTO public.digital_pages (
  id,page_type,slug,title,subtitle,description,seo_title,seo_description,theme,
  status,version,published_at,business_id,provider_profile_id,digital_page_order_id,
  created_by,updated_by
) VALUES
(
  '00000000-0000-4000-8000-000000000001','MENU','published-menu',
  'Published menu','Public subtitle','Public description','SEO title','SEO description',
  '{"owner_internal_note":"not-for-public-renderer"}','PUBLISHED',3,now(),
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001'
),
(
  '00000000-0000-4000-8000-000000000002','MENU','draft-menu',
  'Draft menu',NULL,NULL,NULL,NULL,'{}',
  'DRAFT',1,NULL,
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  NULL,
  '40000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000002'
);
