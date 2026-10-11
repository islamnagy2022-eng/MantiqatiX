do $$
declare
  t text;
  p text;
begin
  foreach t in array array['restaurant_tables','restaurant_inventory'] loop
    if has_table_privilege('anon', format('public.%I', t), 'INSERT')
       or has_table_privilege('anon', format('public.%I', t), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', t), 'DELETE') then
      raise exception 'RC461_ANON_DIRECT_MUTATION_REMAINS:%', t;
    end if;
    if has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', t), 'DELETE') then
      raise exception 'RC461_AUTHENTICATED_DIRECT_MUTATION_REMAINS:%', t;
    end if;
    if not has_table_privilege('service_role', format('public.%I', t), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', t), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', t), 'SELECT') then
      raise exception 'RC461_BACKEND_MUTATION_GRANT_MISSING:%', t;
    end if;
  end loop;
  raise notice 'RC461 restaurant mutation boundary integration: PASS';
end
$$;
