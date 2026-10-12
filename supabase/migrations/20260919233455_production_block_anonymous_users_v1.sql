
do $$
declare r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname='public'
  loop
    execute format('drop policy if exists %I on public.%I', 'deny_anonymous_users', r.tablename);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (coalesce((select auth.jwt()->>''is_anonymous''), ''false'') <> ''true'') with check (coalesce((select auth.jwt()->>''is_anonymous''), ''false'') <> ''true'')',
      'deny_anonymous_users', r.tablename
    );
  end loop;
end $$;
