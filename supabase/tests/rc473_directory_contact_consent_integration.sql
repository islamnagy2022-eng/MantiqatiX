DO $test$
DECLARE
  v_id uuid;
  v_failed boolean := false;
BEGIN
  INSERT INTO public.directory_listing_contact_consents(listing_id,scope,consented_by,consent_version)
  VALUES ('20000000-0000-4000-8000-000000000001','PHONE','10000000-0000-4000-8000-000000000001','directory-contact-v1')
  RETURNING id INTO v_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.directory_listing_contact_consents
    WHERE id=v_id AND revoked_at IS NULL AND consented_by='10000000-0000-4000-8000-000000000001'
  ) THEN RAISE EXCEPTION 'active owner consent was not persisted'; END IF;

  v_failed := false;
  BEGIN
    INSERT INTO public.directory_listing_contact_consents(listing_id,scope,consented_by,consent_version)
    VALUES ('20000000-0000-4000-8000-000000000001','PHONE','10000000-0000-4000-8000-000000000002','directory-contact-v1');
  EXCEPTION WHEN unique_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate active consent was allowed'; END IF;

  UPDATE public.directory_listing_contact_consents
  SET revoked_by='10000000-0000-4000-8000-000000000001',
      revoked_at=clock_timestamp(),
      revocation_reason='Owner withdrew consent'
  WHERE id=v_id AND revoked_at IS NULL;
  IF NOT EXISTS (SELECT 1 FROM public.directory_listing_contact_consents WHERE id=v_id AND revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'revocation was not retained as audit history';
  END IF;

  INSERT INTO public.directory_listing_contact_consents(listing_id,scope,consented_by,consent_version)
  VALUES ('20000000-0000-4000-8000-000000000001','PHONE','10000000-0000-4000-8000-000000000002','directory-contact-v1');

  IF NOT has_table_privilege('service_role','public.directory_listing_contact_consents','SELECT')
     OR NOT has_table_privilege('service_role','public.directory_listing_contact_consents','INSERT')
     OR NOT has_table_privilege('service_role','public.directory_listing_contact_consents','UPDATE') THEN
    RAISE EXCEPTION 'service_role missing consent registry privileges';
  END IF;
  IF has_table_privilege('anon','public.directory_listing_contact_consents','SELECT')
     OR has_table_privilege('authenticated','public.directory_listing_contact_consents','SELECT')
     OR has_table_privilege('anon','public.directory_listing_contact_consents','INSERT')
     OR has_table_privilege('authenticated','public.directory_listing_contact_consents','INSERT') THEN
    RAISE EXCEPTION 'browser roles can access private consent registry';
  END IF;
  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='public.directory_listing_contact_consents'::regclass) THEN
    RAISE EXCEPTION 'consent registry must enable and force RLS';
  END IF;
END;
$test$;
