-- RC483 integration: run after the RC481 fixture, RC481 grants,
-- RC482 platform-root guard, and RC483 atomic-create migration in disposable PG.
DO $acl$
BEGIN
  IF has_column_privilege('service_role','public.legal_documents','document_type','INSERT')
     OR has_column_privilege('service_role','public.legal_documents','title','INSERT')
     OR has_column_privilege('service_role','public.legal_document_versions','document_id','INSERT')
     OR has_column_privilege('service_role','public.legal_document_versions','content','INSERT')
     OR has_column_privilege('service_role','public.consent_audit_log','actor_user_id','INSERT')
     OR has_table_privilege('service_role','public.legal_documents','INSERT')
     OR has_table_privilege('service_role','public.legal_document_versions','INSERT')
     OR has_table_privilege('service_role','public.consent_audit_log','INSERT') THEN
    RAISE EXCEPTION 'RC483_DIRECT_SERVICE_ROLE_INSERT_PRIVILEGE_REMAINS';
  END IF;

  IF NOT has_column_privilege('service_role','public.legal_documents','id','SELECT')
     OR NOT has_column_privilege('service_role','public.legal_document_versions','content','SELECT') THEN
    RAISE EXCEPTION 'RC483_RC481_LEGAL_CENTER_READ_ALLOWLIST_WAS_REMOVED';
  END IF;

  IF has_function_privilege('anon','public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text)','EXECUTE')
     OR has_function_privilege('authenticated','public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.legal_create_document_backend(uuid,text,text,text[],boolean,boolean,text[],text)','EXECUTE')
     OR has_function_privilege('anon','public.legal_create_draft_version_backend(uuid,uuid,integer,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.legal_create_draft_version_backend(uuid,uuid,integer,text)','EXECUTE')
     OR NOT has_function_privilege('service_role','public.legal_create_draft_version_backend(uuid,uuid,integer,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC483_ATOMIC_RPC_EXECUTE_ACL_INVALID';
  END IF;
END;
$acl$;

CREATE FUNCTION public.rc483_fail_selected_legal_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('test.rc483_fail_event', true) = NEW.event_type THEN
    RAISE EXCEPTION 'RC483_TEST_AUDIT_FAILURE';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER rc483_fail_selected_legal_audit
BEFORE INSERT ON public.consent_audit_log
FOR EACH ROW EXECUTE FUNCTION public.rc483_fail_selected_legal_audit();

-- An audit failure must roll back document creation, not leave an unaudited row.
SET ROLE service_role;
DO $document_rollback$
BEGIN
  PERFORM set_config('test.rc483_fail_event','LEGAL_DOCUMENT_CREATED',false);
  BEGIN
    PERFORM public.legal_create_document_backend(
      '10000000-0000-4000-8000-000000000001',
      'TERMS','RC483 rollback document',ARRAY['ALL']::text[],true,false,
      ARRAY[]::text[],'ar-EG'
    );
    RAISE EXCEPTION 'RC483_EXPECTED_DOCUMENT_AUDIT_FAILURE_NOT_RAISED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RC483_TEST_AUDIT_FAILURE' THEN RAISE; END IF;
  END;
END;
$document_rollback$;
RESET ROLE;

DO $document_rollback_assert$
BEGIN
  IF EXISTS (SELECT 1 FROM public.legal_documents WHERE title='RC483 rollback document') THEN
    RAISE EXCEPTION 'RC483_UNAUDITED_DOCUMENT_PERSISTED';
  END IF;
END;
$document_rollback_assert$;

DROP TRIGGER rc483_fail_selected_legal_audit ON public.consent_audit_log;
DROP FUNCTION public.rc483_fail_selected_legal_audit();

-- A valid root actor creates a document and its audit record in one transaction.
SET ROLE service_role;
DO $document_create$
BEGIN
  PERFORM set_config('test.rc483_fail_event','',false);
  PERFORM public.legal_create_document_backend(
    '10000000-0000-4000-8000-000000000001',
    'TERMS','RC483 successful document',ARRAY['all','customer']::text[],true,false,
    ARRAY['general']::text[],'ar-EG'
  );
END;
$document_create$;
RESET ROLE;

DO $document_create_assert$
DECLARE v_document_id uuid;
BEGIN
  SELECT id INTO v_document_id FROM public.legal_documents WHERE title='RC483 successful document';
  IF v_document_id IS NULL THEN RAISE EXCEPTION 'RC483_DOCUMENT_NOT_CREATED'; END IF;
  IF (SELECT count(*) FROM public.consent_audit_log
      WHERE document_id=v_document_id AND event_type='LEGAL_DOCUMENT_CREATED') <> 1 THEN
    RAISE EXCEPTION 'RC483_DOCUMENT_AUDIT_NOT_ATOMIC_OR_MISSING';
  END IF;
END;
$document_create_assert$;

-- An audit failure must also roll back draft-version creation.
CREATE FUNCTION public.rc483_fail_selected_legal_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('test.rc483_fail_event', true) = NEW.event_type THEN
    RAISE EXCEPTION 'RC483_TEST_AUDIT_FAILURE';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER rc483_fail_selected_legal_audit
BEFORE INSERT ON public.consent_audit_log
FOR EACH ROW EXECUTE FUNCTION public.rc483_fail_selected_legal_audit();

SET ROLE service_role;
DO $version_rollback$
DECLARE v_document_id uuid;
BEGIN
  SELECT id INTO v_document_id FROM public.legal_documents WHERE title='RC483 successful document';
  PERFORM set_config('test.rc483_fail_event','LEGAL_DRAFT_VERSION_CREATED',false);
  BEGIN
    PERFORM public.legal_create_draft_version_backend(
      '10000000-0000-4000-8000-000000000001',v_document_id,1,'Draft legal content'
    );
    RAISE EXCEPTION 'RC483_EXPECTED_VERSION_AUDIT_FAILURE_NOT_RAISED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'RC483_TEST_AUDIT_FAILURE' THEN RAISE; END IF;
  END;
END;
$version_rollback$;
RESET ROLE;

DO $version_rollback_assert$
DECLARE v_document_id uuid;
BEGIN
  SELECT id INTO v_document_id FROM public.legal_documents WHERE title='RC483 successful document';
  IF EXISTS (SELECT 1 FROM public.legal_document_versions
             WHERE document_id=v_document_id AND version_number=1) THEN
    RAISE EXCEPTION 'RC483_UNAUDITED_VERSION_PERSISTED';
  END IF;
END;
$version_rollback_assert$;

DROP TRIGGER rc483_fail_selected_legal_audit ON public.consent_audit_log;
DROP FUNCTION public.rc483_fail_selected_legal_audit();

-- Successful version creation stores a server-computed SHA-256 and one audit row.
SET ROLE service_role;
DO $version_create$
DECLARE v_document_id uuid;
BEGIN
  SELECT id INTO v_document_id FROM public.legal_documents WHERE title='RC483 successful document';
  PERFORM public.legal_create_draft_version_backend(
    '10000000-0000-4000-8000-000000000001',v_document_id,1,'Draft legal content'
  );
END;
$version_create$;
RESET ROLE;

DO $version_create_assert$
DECLARE v_document_id uuid; v_version_id uuid; v_hash text;
BEGIN
  SELECT id INTO v_document_id FROM public.legal_documents WHERE title='RC483 successful document';
  SELECT id,content_hash INTO v_version_id,v_hash
  FROM public.legal_document_versions WHERE document_id=v_document_id AND version_number=1;
  IF v_version_id IS NULL THEN RAISE EXCEPTION 'RC483_VERSION_NOT_CREATED'; END IF;
  IF v_hash <> pg_catalog.encode(extensions.digest('Draft legal content','sha256'),'hex') THEN
    RAISE EXCEPTION 'RC483_SERVER_CONTENT_HASH_MISMATCH';
  END IF;
  IF (SELECT count(*) FROM public.consent_audit_log
      WHERE document_version_id=v_version_id AND event_type='LEGAL_DRAFT_VERSION_CREATED') <> 1 THEN
    RAISE EXCEPTION 'RC483_VERSION_AUDIT_NOT_ATOMIC_OR_MISSING';
  END IF;
END;
$version_create_assert$;

-- Tenant/business identities cannot create legal records even with service-role RPC access.
SET ROLE service_role;
DO $tenant_denied$
BEGIN
  BEGIN
    PERFORM public.legal_create_document_backend(
      '20000000-0000-4000-8000-000000000002',
      'TERMS','RC483 unauthorized document',ARRAY['ALL']::text[],true,false,
      ARRAY[]::text[],'ar-EG'
    );
    RAISE EXCEPTION 'RC483_TENANT_ACTOR_WAS_ACCEPTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'LEGAL_ADMIN_REQUIRED' THEN RAISE; END IF;
  END;
END;
$tenant_denied$;
RESET ROLE;

DO $tenant_denied_assert$
BEGIN
  IF EXISTS (SELECT 1 FROM public.legal_documents WHERE title='RC483 unauthorized document') THEN
    RAISE EXCEPTION 'RC483_UNAUTHORIZED_DOCUMENT_PERSISTED';
  END IF;
END;
$tenant_denied_assert$;

SELECT 'RC483 atomic Legal CMS create/audit contract: PASS' AS result;
