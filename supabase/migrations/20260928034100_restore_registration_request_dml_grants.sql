-- Restore the minimum table privileges required by the existing RLS policies.
-- RLS remains authoritative: authenticated users may only insert/select their own pending requests.
grant select, insert on table public.account_registration_requests to authenticated;
grant select, insert, update on table public.account_registration_requests to service_role;
