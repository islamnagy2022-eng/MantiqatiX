-- RC567: isolated customer self-service digital pages.
-- Forward-only. Adds user ownership and WhatsApp contact without changing legacy business/provider ownership.
alter table public.digital_pages
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists whatsapp_number text;

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.digital_pages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%business_id%'
      and pg_get_constraintdef(oid) ilike '%provider_profile_id%'
  loop
    execute format('alter table public.digital_pages drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.digital_pages
  add constraint digital_pages_owner_scope_check
  check (owner_user_id is not null or business_id is not null or provider_profile_id is not null);

alter table public.digital_pages
  add constraint digital_pages_whatsapp_format_check
  check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{8,15}$');

create index if not exists digital_pages_owner_user_idx
  on public.digital_pages(owner_user_id);

-- Keep legacy membership/provider access intact; add the independent paid-customer path.
drop policy if exists digital_pages_owner_select on public.digital_pages;
create policy digital_pages_owner_select on public.digital_pages
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or (business_id is not null and exists (
    select 1 from public.user_memberships m
    where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
      and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
  ))
  or (provider_profile_id is not null and exists (
    select 1 from public.marketing_provider_profiles p
    where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid())
  ))
);

drop policy if exists digital_pages_owner_insert on public.digital_pages;
create policy digital_pages_owner_insert on public.digital_pages
for insert to authenticated
with check (
  created_by=(select auth.uid()) and updated_by=(select auth.uid()) and status='DRAFT'
  and (
    (
      owner_user_id=(select auth.uid()) and business_id is null and provider_profile_id is null
      and whatsapp_number is not null and digital_page_order_id is not null
      and exists (
        select 1 from public.digital_page_orders o
        where o.id=digital_page_order_id and o.user_id=(select auth.uid())
          and o.page_type=digital_pages.page_type and o.payment_status='PAID'
          and o.fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED')
      )
    )
    or (business_id is not null and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
        and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
    ))
    or (provider_profile_id is not null and exists (
      select 1 from public.marketing_provider_profiles p
      where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists digital_pages_owner_update_draft on public.digital_pages;
create policy digital_pages_owner_update_draft on public.digital_pages
for update to authenticated
using (
  (status <> 'PUBLISHED' or exists (select 1 from public.digital_page_orders po where po.id=digital_pages.digital_page_order_id and po.user_id=(select auth.uid()) and po.payment_status='PAID' and po.fulfillment_status='PUBLISHED')) and (
    (owner_user_id=(select auth.uid()) and exists (
      select 1 from public.digital_page_orders o
      where o.id=digital_pages.digital_page_order_id and o.user_id=(select auth.uid())
        and o.payment_status='PAID'
        and o.fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED')
    ))
    or (business_id is not null and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
        and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
    ))
    or (provider_profile_id is not null and exists (
      select 1 from public.marketing_provider_profiles p
      where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid())
    ))
  )
)
with check (
  updated_by=(select auth.uid()) and (status <> 'PUBLISHED' or exists (select 1 from public.digital_page_orders po where po.id=digital_pages.digital_page_order_id and po.user_id=(select auth.uid()) and po.payment_status='PAID' and po.fulfillment_status='PUBLISHED'))
  and (
    (owner_user_id=(select auth.uid()) and business_id is null and provider_profile_id is null
      and whatsapp_number is not null and exists (
        select 1 from public.digital_page_orders o
        where o.id=digital_pages.digital_page_order_id and o.user_id=(select auth.uid())
          and o.payment_status='PAID'
          and o.fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED')
      ))
    or (business_id is not null and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
        and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
    ))
    or (provider_profile_id is not null and exists (
      select 1 from public.marketing_provider_profiles p
      where p.id=digital_pages.provider_profile_id and p.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists digital_page_sections_owner_manage on public.digital_page_sections;
create policy digital_page_sections_owner_manage on public.digital_page_sections
for all to authenticated
using (
  exists (
    select 1 from public.digital_pages p
    where p.id=digital_page_sections.page_id and (
      (p.owner_user_id=(select auth.uid()) and exists (
        select 1 from public.digital_page_orders o
        where o.id=p.digital_page_order_id and o.user_id=(select auth.uid())
          and o.payment_status='PAID'
          and o.fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED')
      ))
      or (p.business_id is not null and exists (
        select 1 from public.user_memberships m
        where m.user_id=(select auth.uid()) and m.business_id=p.business_id
          and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
      ))
      or (p.provider_profile_id is not null and exists (
        select 1 from public.marketing_provider_profiles mp
        where mp.id=p.provider_profile_id and mp.owner_user_id=(select auth.uid())
      ))
    )
  )
)
with check (
  exists (
    select 1 from public.digital_pages p
    where p.id=digital_page_sections.page_id and (
      (p.owner_user_id=(select auth.uid()) and exists (
        select 1 from public.digital_page_orders o
        where o.id=p.digital_page_order_id and o.user_id=(select auth.uid())
          and o.payment_status='PAID'
          and o.fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED')
      ))
      or (p.business_id is not null and exists (
        select 1 from public.user_memberships m
        where m.user_id=(select auth.uid()) and m.business_id=p.business_id
          and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
      ))
      or (p.provider_profile_id is not null and exists (
        select 1 from public.marketing_provider_profiles mp
        where mp.id=p.provider_profile_id and mp.owner_user_id=(select auth.uid())
      ))
    )
  )
);
