-- Run after RC481 fixture and migration in disposable PostgreSQL.
DO $acl$
BEGIN
  IF has_table_privilege('service_role','public.legal_documents','SELECT')
     OR has_table_privilege('service_role','public.legal_document_versions','SELECT')
     OR has_table_privilege('service_role','public.legal_requirements','SELECT')
     OR has_table_privilege('service_role','public.user_consents','SELECT')
     OR has_table_privilege('service_role','public.consent_audit_log','SELECT') THEN
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_TABLE_LEVEL_SELECT_TOO_BROAD';
  END IF;
  IF has_table_privilege('service_role','public.legal_documents','INSERT')
     OR has_table_privilege('service_role','public.legal_document_versions','INSERT')
     OR has_table_privilege('service_role','public.consent_audit_log','INSERT') THEN
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_TABLE_LEVEL_INSERT_TOO_BROAD';
  END IF;
  IF has_table_privilege('service_role','public.legal_documents','UPDATE')
     OR has_table_privilege('service_role','public.legal_documents','DELETE')
     OR has_table_privilege('service_role','public.legal_document_versions','UPDATE')
     OR has_table_privilege('service_role','public.legal_document_versions','DELETE')
     OR has_table_privilege('service_role','public.consent_audit_log','UPDATE')
     OR has_table_privilege('service_role','public.consent_audit_log','DELETE') THEN
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_MUTATION_PRIVILEGE_TOO_BROAD';
  END IF;

  IF NOT has_column_privilege('service_role','public.legal_documents','document_type','SELECT')
     OR NOT has_column_privilege('service_role','public.legal_documents','status','SELECT')
     OR NOT has_column_privilege('service_role','public.legal_documents','document_type','INSERT')
     OR NOT has_column_privilege('service_role','public.legal_documents','id','SELECT') THEN
    RAISE EXCEPTION 'RC481_LEGAL_DOCUMENT_REQUIRED_COLUMNS_MISSING';
  END IF;

  IF NOT has_column_privilege('service_role','public.legal_document_versions','content','SELECT')
     OR NOT has_column_privilege('service_role','public.legal_document_versions','document_id','INSERT')
     OR NOT has_column_privilege('service_role','public.legal_document_versions','id','SELECT')
     OR NOT has_column_privilege('service_role','public.legal_document_versions','content_hash','SELECT') THEN
    RAISE EXCEPTION 'RC481_LEGAL_VERSION_REQUIRED_COLUMNS_MISSING';
  END IF;

  IF NOT has_column_privilege('service_role','public.legal_requirements','enabled','SELECT')
     OR NOT has_column_privilege('service_role','public.user_consents','user_id','SELECT')
     OR NOT has_column_privilege('service_role','public.consent_audit_log','metadata','INSERT') THEN
    RAISE EXCEPTION 'RC481_REQUIRED_EDGE_COLUMNS_MISSING';
  END IF;

  IF has_column_privilege('service_role','public.legal_documents','metadata','SELECT')
     OR has_column_privilege('service_role','public.legal_documents','created_by','SELECT')
     OR has_column_privilege('service_role','public.legal_document_versions','metadata','SELECT')
     OR has_column_privilege('service_role','public.legal_document_versions','created_by','SELECT')
     OR has_column_privilege('service_role','public.user_consents','ip_address','SELECT')
     OR has_column_privilege('service_role','public.user_consents','user_agent','SELECT')
     OR has_column_privilege('service_role','public.user_consents','device_info','SELECT')
     OR has_column_privilege('service_role','public.user_consents','metadata','SELECT')
     OR has_column_privilege('service_role','public.consent_audit_log','metadata','SELECT') THEN
    RAISE EXCEPTION 'RC481_UNNECESSARY_SENSITIVE_READ_GRANT';
  END IF;

  IF NOT has_table_privilege('anon','public.legal_documents','SELECT')
     OR NOT has_table_privilege('anon','public.legal_document_versions','SELECT')
     OR NOT has_table_privilege('authenticated','public.legal_documents','SELECT')
     OR NOT has_table_privilege('authenticated','public.legal_documents','INSERT')
     OR NOT has_table_privilege('authenticated','public.legal_documents','UPDATE')
     OR NOT has_table_privilege('authenticated','public.legal_documents','DELETE') THEN
    RAISE EXCEPTION 'RC481_EXISTING_ANON_AUTHENTICATED_GRANTS_CHANGED';
  END IF;
END;
$acl$;

INSERT INTO public.legal_requirements(action_key,document_type,target_audience,required,enabled,business_scoped)
VALUES('CHECKOUT','TERMS','ALL',true,true,false);

SET ROLE service_role;
DO $edge_reads$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.legal_documents
    WHERE status='PUBLISHED';
  IF v_count<>0 THEN RAISE EXCEPTION 'RC481_LEGAL_DOCUMENT_READ_FAILED'; END IF;

  SELECT count(*) INTO v_count FROM public.legal_document_versions
    WHERE status='PUBLISHED';
  IF v_count<>0 THEN RAISE EXCEPTION 'RC481_LEGAL_VERSION_READ_FAILED'; END IF;

  SELECT count(*) INTO v_count FROM public.legal_requirements
    WHERE enabled=true AND required=true;
  IF v_count<>1 THEN RAISE EXCEPTION 'RC481_LEGAL_REQUIREMENTS_READ_FAILED'; END IF;

  SELECT count(*) INTO v_count FROM public.user_consents
    WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF v_count<>0 THEN RAISE EXCEPTION 'RC481_USER_CONSENTS_FILTER_READ_FAILED'; END IF;

  BEGIN
    PERFORM metadata FROM public.legal_documents LIMIT 1;
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_METADATA_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM created_by FROM public.legal_documents LIMIT 1;
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_CREATOR_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM ip_address FROM public.user_consents LIMIT 1;
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_CONSENT_IP_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$edge_reads$;

DO $edge_inserts$
DECLARE v_doc uuid; v_version uuid;
BEGIN
  INSERT INTO public.legal_documents(
    document_type,title,target_audience,required_consent,requires_reconsent,
    sector_codes,locale,status,created_by,updated_by
  ) VALUES(
    'TERMS','Terms',ARRAY['ALL'],true,true,ARRAY[]::text[],'ar-EG','DRAFT',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) RETURNING id INTO v_doc;

  INSERT INTO public.legal_document_versions(
    document_id,version_number,content,content_hash,status,created_by
  ) VALUES(
    v_doc,1,'Terms content',repeat('a',64),'DRAFT',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) RETURNING id INTO v_version;

  INSERT INTO public.consent_audit_log(
    actor_user_id,event_type,document_id,document_version_id,event_at,metadata
  ) VALUES(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','LEGAL_DOCUMENT_CREATED',
    v_doc,v_version,now(),'{"fixture":true}'::jsonb
  );
END;
$edge_inserts$;

DO $edge_denied$
BEGIN
  BEGIN
    UPDATE public.legal_documents SET title='forbidden';
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_UPDATE_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.legal_document_versions;
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_DELETE_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    SELECT * FROM public.consent_audit_log LIMIT 1;
    RAISE EXCEPTION 'RC481_SERVICE_ROLE_AUDIT_READ_SUCCEEDED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$edge_denied$;
RESET ROLE;

SET ROLE anon;
DO $anon$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.legal_documents WHERE status='PUBLISHED';
  IF v_count<>0 THEN RAISE EXCEPTION 'RC481_ANON_READ_REGRESSED'; END IF;
END;
$anon$;
RESET ROLE;

SET ROLE authenticated;
DO $authenticated$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.legal_documents;
  IF v_count<>0 THEN RAISE EXCEPTION 'RC481_AUTHENTICATED_READ_REGRESSED'; END IF;
END;
$authenticated$;
RESET ROLE;

SELECT 'RC481 Legal Edge least-privilege ACL: PASS' AS result;
