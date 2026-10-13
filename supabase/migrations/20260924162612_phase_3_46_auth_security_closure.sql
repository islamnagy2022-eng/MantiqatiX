-- Phase 3.46: make the internal legacy idempotency table explicitly deny direct API access.
-- The table is consumed by SECURITY DEFINER mutation functions; it must not be directly readable/writable.
drop policy if exists legacy_idempotency_deny_direct on public.legacy_module_idempotency;
create policy legacy_idempotency_deny_direct
on public.legacy_module_idempotency
as restrictive
for all
to public
using (false)
with check (false);

-- Keep anonymous execution closed for the legacy mutation helpers.
revoke execute on function public.restaurant_erp_mutate(text,jsonb,text) from anon;
revoke execute on function public.restaurant_table_mutate(text,jsonb,text) from anon;
revoke execute on function public.fashion_erp_mutate(text,jsonb,text) from anon;
