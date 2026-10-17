REVOKE EXECUTE ON FUNCTION net.http_post(text,jsonb,jsonb,jsonb,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION net.http_get(text,jsonb,jsonb,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION net.http_delete(text,jsonb,jsonb,integer,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION net.http_collect_response(bigint,boolean) FROM PUBLIC;