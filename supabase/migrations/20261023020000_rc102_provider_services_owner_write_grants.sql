-- RC102: make the existing owner-scoped provider-service UI writes executable.
-- This grants table privileges only; RLS remains the authorization boundary.
-- marketing_provider_services_owner_manage restricts writes to non-anonymous
-- authenticated users who own the referenced marketing_provider_profiles row.
-- Do not broaden grants to anon, public, or service_role.
grant insert, update, delete on table public.marketing_provider_services to authenticated;
