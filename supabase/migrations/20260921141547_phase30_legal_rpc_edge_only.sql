BEGIN;
REVOKE ALL ON FUNCTION public.legal_assert_action(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.legal_check_action(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.legal_publish_version(uuid,integer,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_legal_consent(uuid,uuid,text,uuid,text,text,jsonb,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.legal_check_action(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.legal_publish_version(uuid,integer,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_legal_consent_backend(uuid,uuid,uuid,text,uuid,text,text,jsonb,text,text,text) TO service_role;
COMMIT;
