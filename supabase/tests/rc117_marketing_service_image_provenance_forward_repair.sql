\if :{?mantiqati_disposable}
  \if :mantiqati_disposable
    \echo 'Running RC117 image-provenance tests in a disposable database.'
  \else
    \echo 'REFUSED: pass -v mantiqati_disposable=on.'
    \quit 3
  \endif
\else
  \echo 'REFUSED: set mantiqati_disposable=on only for an isolated database.'
  \quit 3
\endif

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.marketing_services') IS NULL
     OR to_regprocedure('public.mnty_default_image_url(text,text,text,text)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketing_services' AND column_name='image_url')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketing_services' AND column_name='image_source')
  THEN
    RAISE EXCEPTION 'RC117_IMAGE_PROVENANCE_PREREQUISITES_MISSING';
  END IF;
END;
$$;

ALTER TABLE public.marketing_services DISABLE TRIGGER mnty_marketing_service_default_image;

INSERT INTO public.marketing_services
  (id, code, name_ar, name_en, category_code, description, image_url, image_source)
VALUES
  ('f1170000-0000-4000-8000-000000000001', 'MNTY-RC117-OWNER', 'خدمة مالك', 'Owner image', 'MARKETING', 'owner image fixture', 'https://images.example.test/owner.jpg', 'owner'),
  ('f1170000-0000-4000-8000-000000000002', 'MNTY-RC117-LEGACY-NULL', 'خدمة قديمة', 'Legacy null provenance', 'MARKETING', 'custom image with null provenance', 'https://images.example.test/legacy-null.jpg', NULL),
  ('f1170000-0000-4000-8000-000000000003', 'MNTY-RC117-LEGACY-BLANK', 'خدمة قديمة فارغة', 'Legacy blank provenance', 'MARKETING', 'custom image with blank provenance', 'https://images.example.test/legacy-blank.jpg', ''),
  ('f1170000-0000-4000-8000-000000000004', 'MNTY-RC117-BLANK-IMAGE', 'خدمة بلا صورة', 'Blank image', 'MARKETING', 'generate only when image is blank', NULL, NULL),
  ('f1170000-0000-4000-8000-000000000005', 'MNTY-RC117-AI', 'خدمة صورة مولدة', 'AI image', 'MARKETING', 'preserve generated-image provenance', 'https://images.example.test/ai-generated.jpg', 'ai_generated'),
  ('f1170000-0000-4000-8000-000000000006', 'MNTY-RC117-AUTO', 'خدمة تلقائية', 'Existing automatic image', 'MARKETING', 'keep existing automatic image', 'https://images.example.test/existing-auto.jpg', 'auto');

ALTER TABLE public.marketing_services ENABLE TRIGGER mnty_marketing_service_default_image;

\i supabase/migrations/20261126020000_preserve_marketing_service_image_provenance.sql

DO $$
DECLARE
  v_row public.marketing_services%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_row FROM public.marketing_services WHERE id='f1170000-0000-4000-8000-000000000001';
  IF v_row.image_url <> 'https://images.example.test/owner.jpg' OR v_row.image_source <> 'owner' THEN RAISE EXCEPTION 'RC117_OWNER_IMAGE_NOT_PRESERVED'; END IF;

  SELECT * INTO STRICT v_row FROM public.marketing_services WHERE id='f1170000-0000-4000-8000-000000000002';
  IF v_row.image_url <> 'https://images.example.test/legacy-null.jpg' OR v_row.image_source <> 'owner' THEN RAISE EXCEPTION 'RC117_NULL_PROVENANCE_CUSTOM_URL_NOT_PRESERVED'; END IF;

  SELECT * INTO STRICT v_row FROM public.marketing_services WHERE id='f1170000-0000-4000-8000-000000000003';
  IF v_row.image_url <> 'https://images.example.test/legacy-blank.jpg' OR v_row.image_source <> 'owner' THEN RAISE EXCEPTION 'RC117_BLANK_PROVENANCE_CUSTOM_URL_NOT_PRESERVED'; END IF;

  SELECT * INTO STRICT v_row FROM public.marketing_services WHERE id='f1170000-0000-4000-8000-000000000004';
  IF coalesce(v_row.image_url,'') = '' OR v_row.image_url NOT LIKE 'https://images.unsplash.com/%' OR v_row.image_source <> 'auto' THEN RAISE EXCEPTION 'RC117_BLANK_IMAGE_DEFAULT_NOT_GENERATED'; END IF;

  SELECT * INTO STRICT v_row FROM public.marketing_services WHERE id='f1170000-0000-4000-8000-000000000005';
  IF v_row.image_url <> 'https://images.example.test/ai-generated.jpg' OR v_row.image_source <> 'ai_generated' THEN RAISE EXCEPTION 'RC117_AI_IMAGE_PROVENANCE_NOT_PRESERVED'; END IF;

  SELECT * INTO STRICT v_row FROM public.marketing_services WHERE id='f1170000-0000-4000-8000-000000000006';
  IF v_row.image_url <> 'https://images.example.test/existing-auto.jpg' OR v_row.image_source <> 'auto' THEN RAISE EXCEPTION 'RC117_EXISTING_AUTO_IMAGE_NOT_PRESERVED'; END IF;
END;
$$;

\i supabase/migrations/20261126020000_preserve_marketing_service_image_provenance.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.marketing_services
    WHERE code LIKE 'MNTY-RC117-%'
      AND (
        (code='MNTY-RC117-OWNER' AND (image_url <> 'https://images.example.test/owner.jpg' OR image_source <> 'owner'))
        OR (code='MNTY-RC117-LEGACY-NULL' AND (image_url <> 'https://images.example.test/legacy-null.jpg' OR image_source <> 'owner'))
        OR (code='MNTY-RC117-LEGACY-BLANK' AND (image_url <> 'https://images.example.test/legacy-blank.jpg' OR image_source <> 'owner'))
        OR (code='MNTY-RC117-BLANK-IMAGE' AND (coalesce(image_url,'') = '' OR image_source <> 'auto'))
        OR (code='MNTY-RC117-AI' AND (image_url <> 'https://images.example.test/ai-generated.jpg' OR image_source <> 'ai_generated'))
        OR (code='MNTY-RC117-AUTO' AND (image_url <> 'https://images.example.test/existing-auto.jpg' OR image_source <> 'auto'))
      )
  ) THEN
    RAISE EXCEPTION 'RC117_IMAGE_PROVENANCE_REPAIR_NOT_IDEMPOTENT';
  END IF;
END;
$$;

ROLLBACK;
\echo 'RC117_MARKETING_SERVICE_IMAGE_PROVENANCE_FORWARD_REPAIR=PASS'
