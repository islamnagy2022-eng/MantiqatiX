-- RC — server-authorized used-item directory reads.
-- Return only public listing fields; never expose seller_phone through the Data API.
-- Keep owner-only sold listings visible so a future owner workflow can recover them.
begin;

create or replace function public.list_used_item_ads_backend(
  p_tenant_id varchar default null,
  p_business_id uuid default null
)
returns table (
  id uuid,
  title varchar,
  category varchar,
  price numeric,
  seller_name varchar,
  location varchar,
  is_sold boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'authenticated non-anonymous session required'
      using errcode = '42501';
  end if;

  return query
    select a.id, a.title, a.category, a.price, a.seller_name,
           a.location, a.is_sold, a.created_at
      from public.used_item_ads as a
     where (a.is_sold = false or a.owner_user_id = auth.uid())
       and (p_tenant_id is null or a.tenant_id = p_tenant_id)
       and (p_business_id is null or a.business_id = p_business_id)
     order by a.created_at desc
     limit 100;
end;
$function$;

-- Prevent accidental table-level reads/writes from the browser API.
-- This function is the sole authenticated read path for the directory.
revoke select, insert, update, delete on table public.used_item_ads from anon, authenticated;
revoke all on function public.list_used_item_ads_backend(varchar, uuid) from public, anon;
grant execute on function public.list_used_item_ads_backend(varchar, uuid) to authenticated;

commit;
