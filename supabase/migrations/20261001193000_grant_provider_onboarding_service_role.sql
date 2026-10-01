-- Provider onboarding Edge Function executes through service_role.
-- Keep the private RPCs non-callable by client roles.
grant usage on schema private to service_role;
grant execute on function private.submit_provider_onboarding(uuid,uuid,varchar,varchar,varchar,varchar,varchar,text,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function private.review_provider_onboarding_atomic(uuid,uuid,text,text) to service_role;
grant execute on function private.review_registration_request_atomic(uuid,uuid,text,varchar,varchar) to service_role;
