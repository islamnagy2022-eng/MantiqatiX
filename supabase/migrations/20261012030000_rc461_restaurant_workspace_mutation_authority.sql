-- RC461: enforce server-authoritative restaurant table and inventory writes.
-- Reads remain available under existing RLS policies. Mutations now pass through
-- restaurant-workspace-mutate, which verifies the actor's active tenant/business/branch membership.
revoke insert, update, delete on table public.restaurant_tables, public.restaurant_inventory
  from PUBLIC, anon, authenticated;

-- The Edge Function uses the service role only after validating the actor and exact workspace scope.
grant select, insert, update, delete on table public.restaurant_tables, public.restaurant_inventory to service_role;

do $$
begin
  if has_table_privilege('authenticated', 'public.restaurant_tables', 'INSERT')
     or has_table_privilege('authenticated', 'public.restaurant_tables', 'UPDATE')
     or has_table_privilege('authenticated', 'public.restaurant_tables', 'DELETE')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'INSERT')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'UPDATE')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'DELETE') then
    raise exception 'RC461_DIRECT_RESTAURANT_MUTATION_PRIVILEGE_REMAINS';
  end if;
end
$$;
