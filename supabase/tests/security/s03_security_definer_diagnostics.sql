-- S03 read-only SECURITY DEFINER diagnostic inventory.
-- Intended for a disposable PostgreSQL database with the MantiqatiX schema loaded.
-- Catalog inspection only: no business RPC calls, DML, DDL, or privilege changes.
WITH target_functions AS (
  SELECT n.nspname AS schema_name,
         p.proname AS function_name,
         pg_get_function_identity_arguments(p.oid) AS identity_arguments,
         p.oid,
         p.prosecdef,
         coalesce(array_to_string(p.proconfig, ','), '') AS function_config,
         pg_get_functiondef(p.oid) AS definition,
         has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
         has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_schema_usage
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE (n.nspname = 'public' AND p.proname IN (
           'get_mnty_targeted_advertisements',
           'list_open_mantigo_rides_backend',
           'list_mantigo_customer_rides_backend',
           'create_mantigo_bid_backend'
         ))
     OR (n.nspname = 'private' AND p.proname = 'legal_is_admin')
)
SELECT schema_name || '.' || function_name || '(' || identity_arguments || ')' AS function_signature,
       CASE
         WHEN function_name = 'get_mnty_targeted_advertisements'
           THEN CASE WHEN function_config ~ 'search_path=""|search_path=$'
                     THEN 'PASS: empty search_path'
                     ELSE 'REVIEW: search_path not empty' END
         WHEN function_name = 'list_open_mantigo_rides_backend'
           THEN CASE WHEN definition ILIKE '%cp.status = ''ACTIVE''%'
                       AND definition ILIKE '%cp.verification_status = ''VERIFIED''%'
                       AND definition ILIKE '%cp.availability_status = ''AVAILABLE''%'
                     THEN 'PASS: captain gate present'
                     ELSE 'REVIEW: active/verified/available captain gate missing' END
         WHEN function_name = 'list_mantigo_customer_rides_backend'
           THEN CASE WHEN definition ILIKE '%to_jsonb(b)%' OR definition ILIKE '%to_jsonb(f)%'
                     THEN 'REVIEW: full bid/financial row serialization'
                     ELSE 'PASS: no direct full-row bid/ledger serialization pattern' END
         WHEN function_name = 'create_mantigo_bid_backend'
           THEN CASE WHEN definition ILIKE '%coalesce(nullif(trim(p_captain_name)%'
                       OR definition ILIKE '%coalesce(trim(p_captain_phone)%'
                     THEN 'REVIEW: caller-supplied captain name/phone persisted'
                     ELSE 'REVIEW: verify authoritative identity/contact source' END
         WHEN function_name = 'legal_is_admin'
           THEN CASE WHEN identity_arguments ILIKE '%p_user_id uuid%'
                       AND definition ILIKE '%coalesce(p_user_id, auth.uid())%'
                       AND authenticated_execute
                       AND authenticated_schema_usage
                     THEN 'REVIEW: UUID overload callable in private schema; verify API exposure/internal call path'
                     ELSE 'INFO: inspect overload contract and schema exposure' END
         ELSE 'INFO: manual review required'
       END AS diagnostic_status,
       function_config,
       prosecdef AS security_definer,
       anon_execute,
       authenticated_execute,
       authenticated_schema_usage
FROM target_functions
ORDER BY schema_name, function_name, identity_arguments;
