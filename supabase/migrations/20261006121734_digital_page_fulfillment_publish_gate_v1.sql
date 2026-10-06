-- Digital page publication must be controlled by paid fulfillment.
alter table public.digital_pages add column if not exists digital_page_order_id uuid references public.digital_page_orders(id) on delete set null;
create unique index if not exists digital_pages_order_uidx on public.digital_pages(digital_page_order_id) where digital_page_order_id is not null;

drop policy if exists digital_pages_owner_manage on public.digital_pages;
create policy digital_pages_owner_select on public.digital_pages for select to authenticated
using (
  (business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) = any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])))
  or
  (provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles p where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid())))
);
create policy digital_pages_owner_insert on public.digital_pages for insert to authenticated
with check (
  status='DRAFT' and created_by=(select auth.uid()) and updated_by=(select auth.uid()) and
  ((business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) = any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])))
   or
   (provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles p where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid()))))
);
create policy digital_pages_owner_update_draft on public.digital_pages for update to authenticated
using (
  status <> 'PUBLISHED' and
  ((business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) = any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])))
   or
   (provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles p where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid()))))
)
with check (
  status <> 'PUBLISHED' and updated_by=(select auth.uid()) and
  ((business_id is not null and exists (select 1 from public.user_memberships m where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) = any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])))
   or
   (provider_profile_id is not null and exists (select 1 from public.marketing_provider_profiles p where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid()))))
);
create policy digital_pages_admin_manage on public.digital_pages for all to authenticated using ((select public.mnty_can_platform_admin())) with check ((select public.mnty_can_platform_admin()));

create or replace function public.fulfill_digital_page_publish(p_actor_user_id uuid,p_order_id uuid,p_page_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_order public.digital_page_orders%rowtype; v_page public.digital_pages%rowtype;
begin
  if p_actor_user_id is null or p_actor_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  select * into v_order from public.digital_page_orders where id=p_order_id for update;
  if not found then raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND'; end if;
  if v_order.payment_status <> 'PAID' then raise exception 'PAYMENT_REQUIRED'; end if;
  if v_order.fulfillment_status not in ('REQUESTED','IN_REVIEW','IN_PROGRESS') then raise exception 'INVALID_FULFILLMENT_STATE'; end if;
  select * into v_page from public.digital_pages where id=p_page_id for update;
  if not found then raise exception 'DIGITAL_PAGE_NOT_FOUND'; end if;
  if v_page.created_by <> v_order.user_id then raise exception 'PAGE_OWNER_MISMATCH'; end if;
  if v_page.page_type <> v_order.page_type then raise exception 'PAGE_TYPE_MISMATCH'; end if;
  if v_page.status='PUBLISHED' then return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',true); end if;
  update public.digital_pages set digital_page_order_id=v_order.id,status='PUBLISHED',published_at=coalesce(published_at,now()),version=version+1,updated_by=p_actor_user_id,updated_at=now() where id=v_page.id;
  update public.digital_page_orders set fulfillment_status='PUBLISHED',updated_at=now() where id=v_order.id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,metadata,created_at)
  values(gen_random_uuid(),'MNTY-PLATFORM',p_actor_user_id,'DIGITAL_PAGE_PUBLISHED','digital_page_order',v_order.id::text,jsonb_build_object('page_id',v_page.id,'page_type',v_page.page_type),now());
  return jsonb_build_object('page_id',v_page.id,'order_id',v_order.id,'status','PUBLISHED','replayed',false);
end;
$function$;
revoke all on function public.fulfill_digital_page_publish(uuid,uuid,uuid) from public;
revoke all on function public.fulfill_digital_page_publish(uuid,uuid,uuid) from anon;
grant execute on function public.fulfill_digital_page_publish(uuid,uuid,uuid) to authenticated;
