-- Run after the RC481 fixture and migration in disposable PostgreSQL.
DO $assertions$
DECLARE
  v_denied boolean;
  v_id uuid;
  v_status text;
  v_count integer;
  v_row record;
BEGIN
  -- No table-wide privileges are added for service_role.
  IF has_table_privilege('service_role','public.legal_documents','SELECT')
     OR has_table_privilege('service_role','public.legal_documents','INSERT')
     OR has_table_privilege('service_role','public.legal_documents','UPDATE')
     OR has_table_privilege('service_role','public.legal_documents','DELETE')
     OR has_table_privilege('service_role','public.legal_document_versions','SELECT')
     OR has_table_privilege('service_role','public.legal_document_versions','INSERT')
     OR has_table_privilege('service_role','public.legal_document_versions','UPDATE')
     OR has_table_privilege('service_role','public.legal_document_versions','DELETE')
     OR has_table_privilege('service_role','public.legal_requirements','SELECT')
     OR has_table_privilege('service_role','public.user_consents','SELECT')
     OR has_table_privilege('service_role','public.consent_audit_log','INSERT')
     OR has_table_privilege('service_role','public.consent_audit_log','SELECT')
     OR has_table_privilege('service_role','public.consent_audit_log','UPDATE')
     OR has_table_privilege('service_role','public.consent_audit_log','DELETE') THEN
    RAISE EXCEPTION 'RC481_UNEXPECTED_TABLE_LEVEL_SERVICE_ROLE_PRIVILEGE';
  END IF;

  -- legal-center read allowlists, including the user_id filter column.
  IF NOT (
    has_column_privilege('service_role','public.legal_documents','id','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','document_type','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','title','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','status','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','published_at','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','effective_at','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','target_audience','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','required_consent','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','requires_reconsent','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','sector_codes','SELECT')
    AND has_column_privilege('service_role','public.legal_documents','locale','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','id','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','document_id','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','version_number','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','published_at','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','effective_at','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','content_hash','SELECT')
    AND has_column_privilege('service_role','public.legal_document_versions','content','SELECT')
    AND has_column_privilege('service_role','public.legal_requirements','action_key','SELECT')
    AND has_column_privilege('service_role','public.legal_requirements','document_type','SELECT')
    AND has_column_privilege('service_role','public.legal_requirements','target_audience','SELECT')
    AND has_column_privilege('service_role','public.legal_requirements','required','SELECT')
    AND has_column_privilege('service_role','public.legal_requirements','enabled','SELECT')
    AND has_column_privilege('service_role','public.legal_requirements','business_scoped','SELECT')
    AND has_column_privilege('service_role','public.user_consents','id','SELECT')
    AND has_column_privilege('service_role','public.user_consents','user_id','SELECT')
    AND has_column_privilege('service_role','public.user_consents','document_id','SELECT')
    AND has_column_privilege('service_role','public.user_consents','document_version_id','SELECT')
    AND has_column_privilege('service_role','public.user_consents','agreement_id','SELECT')
    AND has_column_privilege('service_role','public.user_consents','account_type','SELECT')
    AND has_column_privilege('service_role','public.user_consents','consent_status','SELECT')
    AND has_column_privilege('service_role','public.user_consents','consented_at','SELECT')
    AND has_column_privilege('service_role','public.user_consents','content_hash','SELECT')
    AND has_column_privilege('service_role','public.user_consents','source','SELECT')
  ) THEN
    RAISE EXCEPTION 'RC481_REQUIRED_LEGAL_EDGE_SELECT_COLUMN_MISSING';
  END IF;

  -- Sensitive/unused columns are not readable by service_role directly.
  IF has_column_privilege('service_role','public.legal_documents','tenant_id','SELECT')
     OR has_column_privilege('service_role','public.legal_documents','created_by','SELECT')
     OR has_column_privilege('service_role','public.legal_documents','updated_by','SELECT')
     OR has_column_privilege('service_role','public.legal_documents','metadata','SELECT')
     OR has_column_privilege('service_role','public.legal_documents','created_at','SELECT')
     OR has_column_privilege('service_role','public.legal_documents','updated_at','SELECT')
     OR has_column_privilege('service_role','public.legal_document_versions','created_by','SELECT')
     OR has_column_privilege('service_role','public.legal_document_versions','retired_at','SELECT')
     OR has_column_privilege('service_role','public.legal_document_versions','metadata','SELECT')
     OR has_column_privilege('service_role','public.user_consents','ip_address','SELECT')
     OR has_column_privilege('service_role','public.user_consents','user_agent','SELECT')
     OR has_column_privilege('service_role','public.user_consents','device_info','SELECT')
     OR has_column_privilege('service_role','public.user_consents','session_id','SELECT')
     OR has_column_privilege('service_role','public.user_consents','metadata','SELECT') THEN
    RAISE EXCEPTION 'RC481_UNNECESSARY_OR_SENSITIVE_SELECT_COLUMN_GRANTED';
  END IF;

  -- Direct Legal CMS INSERT columns only.
  IF NOT (
    has_column_privilege('service_role','public.legal_documents','document_type','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','title','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','target_audience','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','required_consent','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','requires_reconsent','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','sector_codes','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','locale','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','status','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','created_by','INSERT')
    AND has_column_privilege('service_role','public.legal_documents','updated_by','INSERT')
    AND has_column_privilege('service_role','public.legal_document_versions','document_id','INSERT')
    AND has_column_privilege('service_role','public.legal_document_versions','version_number','INSERT')
    AND has_column_privilege('service_role','public.legal_document_versions','content','INSERT')
    AND has_column_privilege('service_role','public.legal_document_versions','content_hash','INSERT')
    AND has_column_privilege('service_role','public.legal_document_versions','status','INSERT')
    AND has_column_privilege('service_role','public.legal_document_versions','created_by','INSERT')
    AND has_column_privilege('service_role','public.consent_audit_log','actor_user_id','INSERT')
    AND has_column_privilege('service_role','public.consent_audit_log','event_type','INSERT')
    AND has_column_privilege('service_role','public.consent_audit_log','document_id','INSERT')
    AND has_column_privilege('service_role','public.consent_audit_log','document_version_id','INSERT')
    AND has_column_privilege('service_role','public.consent_audit_log','event_at','INSERT')
    AND has_column_privilege('service_role','public.consent_audit_log','metadata','INSERT')
  ) THEN
    RAISE EXCEPTION 'RC481_REQUIRED_LEGAL_CMS_INSERT_COLUMN_MISSING';
  END IF;

  IF has_column_privilege('service_role','public.legal_documents','metadata','INSERT')
     OR has_column_privilege('service_role','public.legal_document_versions','metadata','INSERT')
     OR has_column_privilege('service_role','public.consent_audit_log','ip_address','INSERT')
     OR has_column_privilege('service_role','public.consent_audit_log','integrity_hash','INSERT') THEN
    RAISE EXCEPTION 'RC481_UNNECESSARY_LEGAL_CMS_INSERT_COLUMN_GRANTED';
  END IF;

  -- Existing anon/authenticated role boundaries remain unchanged.
  IF NOT has_table_privilege('anon','public.legal_documents','SELECT')
     OR NOT has_table_privilege('anon','public.legal_document_versions','SELECT')
     OR NOT has_table_privilege('authenticated','public.legal_documents','SELECT')
     OR NOT has_table_privilege('authenticated','public.legal_documents','INSERT')
     OR NOT has_table_privilege('authenticated','public.legal_documents','UPDATE')
     OR NOT has_table_privilege('authenticated','public.legal_document_versions','SELECT')
     OR NOT has_table_privilege('authenticated','public.legal_document_versions','INSERT')
     OR NOT has_table_privilege('authenticated','public.legal_document_versions','UPDATE')
     OR NOT has_table_privilege('authenticated','public.legal_requirements','SELECT')
     OR NOT has_table_privilege('authenticated','public.user_consents','SELECT')
     OR NOT has_table_privilege('authenticated','public.consent_audit_log','SELECT') THEN
    RAISE EXCEPTION 'RC481_EXISTING_ANON_OR_AUTHENTICATED_PRIVILEGE_CHANGED';
  END IF;
END;
$assertions$;

-- Exercise the exact service-role projections and the Edge Function inserts.
SET ROLE service_role;

DO $runtime$
DECLARE
  v_document_id uuid := '60000000-0000-4000-8000-000000000001';
  v_version_id uuid := '70000000-0000-4000-8000-000000000001';
  v_user_id uuid := '40000000-0000-4000-8000-000000000001';
  v_count integer;
  v_status text;
  v_denied boolean;
  v_row record;
BEGIN
  SELECT id,document_type,title,status,published_at,effective_at,target_audience,
         required_consent,requires_reconsent,sector_codes,locale
  INTO v_row
  FROM public.legal_documents
  WHERE status='PUBLISHED'
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC481_LEGAL_CENTER_DOCUMENT_READ_FAILED'; END IF;

  SELECT id,document_id,version_number,published_at,effective_at,content_hash,content
  INTO v_row
  FROM public.legal_document_versions
  WHERE status='PUBLISHED' AND effective_at <= now()
  ORDER BY version_number DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC481_LEGAL_CENTER_VERSION_READ_FAILED'; END IF;

  SELECT action_key,document_type,target_audience,required,enabled,business_scoped
  INTO v_row
  FROM public.legal_requirements
  WHERE enabled=true AND required=true
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC481_LEGAL_CENTER_REQUIREMENTS_READ_FAILED'; END IF;

  SELECT id,document_id,document_version_id,agreement_id,account_type,
         consent_status,consented_at,content_hash,source
  INTO v_row
  FROM public.user_consents
  WHERE user_id=v_user_id
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC481_LEGAL_CENTER_OWN_CONSENTS_READ_FAILED'; END IF;

  INSERT INTO public.legal_documents (
    document_type,title,target_audience,required_consent,requires_reconsent,
    sector_codes,locale,status,created_by,updated_by
  ) VALUES (
    'PRIVACY','Draft privacy terms',ARRAY['ALL']::text[],true,false,
    ARRAY['GENERAL']::text[],'ar-EG','DRAFT',v_user_id,v_user_id
  ) RETURNING id,status INTO v_document_id,v_status;
  IF v_status <> 'DRAFT' THEN RAISE EXCEPTION 'RC481_LEGAL_CMS_DOCUMENT_INSERT_FAILED'; END IF;

  INSERT INTO public.legal_document_versions (
    document_id,version_number,content,content_hash,status,created_by
  ) VALUES (
    v_document_id,1,'Draft privacy terms content',
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    'DRAFT',v_user_id
  ) RETURNING id INTO v_version_id;

  INSERT INTO public.consent_audit_log (
    actor_user_id,event_type,document_id,document_version_id,event_at,metadata
  ) VALUES (
    v_user_id,'LEGAL_DOCUMENT_CREATED',v_document_id,null,now(),
    '{"source":"RC481_TEST"}'::jsonb
  );

  -- Sensitive direct reads must fail despite the permitted filtered read path.
  v_denied:=false;
  BEGIN
    EXECUTE 'SELECT tenant_id FROM public.legal_documents LIMIT 1' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_TENANT_ID_SUCCEEDED'; END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'SELECT metadata FROM public.legal_documents LIMIT 1' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_DOCUMENT_METADATA_SUCCEEDED'; END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'SELECT ip_address FROM public.user_consents LIMIT 1' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_CONSENT_IP_SUCCEEDED'; END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'SELECT * FROM public.consent_audit_log LIMIT 1' INTO v_row;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC481_SERVICE_ROLE_READ_AUDIT_LOG_SUCCEEDED'; END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'UPDATE public.legal_documents SET title=''forbidden'' WHERE id=$1' USING v_document_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC481_SERVICE_ROLE_UPDATE_SUCCEEDED'; END IF;

  v_denied:=false;
  BEGIN
    EXECUTE 'DELETE FROM public.legal_documents WHERE id=$1' USING v_document_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'RC481_SERVICE_ROLE_DELETE_SUCCEEDED'; END IF;
END;
$runtime$;

RESET ROLE;
SELECT 'RC481 Legal Edge service-role least-privilege ACL: PASS' AS result;
