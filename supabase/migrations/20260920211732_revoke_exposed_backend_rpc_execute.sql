REVOKE EXECUTE ON FUNCTION public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying) FROM anon;

REVOKE EXECUTE ON FUNCTION public.deactivate_business(uuid,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.deactivate_business(uuid,text) FROM anon;
