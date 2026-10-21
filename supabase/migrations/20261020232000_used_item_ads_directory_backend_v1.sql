-- RC — replace direct used-item column reads with a narrow server-authorized directory RPC.
-- Follow-up to 20261020231500_used_item_ads_minimal_directory_read.sql.
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

-- Remove both table-level and earlier column-level browser read grants.
revoke select, insert, update, delete on table public.used_item_ads from anon, authenticated;
revoke select (
  id, owner_user_id, tenant_id, business_id, title, category, price,
  seller_name, location, is_sold, created_at
) on table public.used_item_ads from authenticated;

revoke all on function public.list_used_item_ads_backend(varchar, uuid) from public, anon;
grant execute on function public.list_used_item_ads_backend(varchar, uuid) to authenticated;

commit;
