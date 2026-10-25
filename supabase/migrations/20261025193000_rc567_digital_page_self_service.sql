-- RC567: isolated customer self-service digital pages.
-- Candidate only. Do not apply until RC563-RC566 migration ordering is reconciled.
alter table public.digital_pages
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists whatsapp_number text;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.digital_pages'::regclass and contype='c'
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

-- A boolean-only helper; no order/customer fields are exposed.
create or replace function public.digital_page_subscription_active(p_order_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_user_id=(select auth.uid()) and exists (
    select 1
    from public.digital_page_orders o
    join public.digital_page_products prod on prod.id=o.product_id
    where o.id=p_order_id
      and o.user_id=(select auth.uid())
      and o.payment_status='PAID'
      and o.fulfillment_status in ('REQUESTED','IN_REVIEW','IN_PROGRESS','PUBLISHED')
      and coalesce((select p.published_at from public.digital_pages p where p.digital_page_order_id=o.id and p.owner_user_id=o.user_id), o.updated_at, o.created_at) + pg_catalog.make_interval(days => greatest(
        1,
        coalesce(
          case when coalesce(o.metadata->>'duration_days','') ~ '^[0-9]{1,5}$'
            then (o.metadata->>'duration_days')::integer end,
          prod.duration_days,
          365
        )
      )) > pg_catalog.now()
  );
$$;
revoke all on function public.digital_page_subscription_active(uuid,uuid) from public, anon;
grant execute on function public.digital_page_subscription_active(uuid,uuid) to authenticated;

create or replace function public.digital_page_public_subscription_active(p_order_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.digital_page_orders o
    join public.digital_page_products prod on prod.id=o.product_id
    where o.id=p_order_id
      and o.payment_status='PAID'
      and o.fulfillment_status='PUBLISHED'
      and coalesce((select p.published_at from public.digital_pages p where p.digital_page_order_id=o.id and p.owner_user_id=o.user_id), o.updated_at, o.created_at) + pg_catalog.make_interval(days => greatest(
        1,
        coalesce(
          case when coalesce(o.metadata->>'duration_days','') ~ '^[0-9]{1,5}$'
            then (o.metadata->>'duration_days')::integer end,
          prod.duration_days,
          365
        )
      )) > pg_catalog.now()
  );
$$;
revoke all on function public.digital_page_public_subscription_active(uuid) from public;
grant execute on function public.digital_page_public_subscription_active(uuid) to anon, authenticated;

-- Customer editing must not bypass the existing platform-admin publication gate or transfer a page between subscriptions.
create or replace function public.digital_page_customer_update_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.owner_user_id is not null then
    if new.owner_user_id is distinct from old.owner_user_id
       or new.digital_page_order_id is distinct from old.digital_page_order_id then
      if not coalesce(public.mnty_can_platform_admin(), false) then
        raise exception 'DIGITAL_PAGE_SUBSCRIPTION_BINDING_IMMUTABLE';
      end if;
    end if;
    if new.status is distinct from old.status
       and not coalesce(public.mnty_can_platform_admin(), false) then
      raise exception 'DIGITAL_PAGE_PUBLISH_ADMIN_REQUIRED';
    end if;
    if not exists (
      select 1 from public.digital_page_orders o
      where o.id=new.digital_page_order_id
        and o.user_id=new.owner_user_id
        and o.page_type=new.page_type
    ) then
      raise exception 'DIGITAL_PAGE_ORDER_TYPE_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_digital_page_customer_update_guard on public.digital_pages;
create trigger trg_digital_page_customer_update_guard
before update on public.digital_pages
for each row execute function public.digital_page_customer_update_guard();

-- Public pages and sections are visible only when published and (for standalone customer pages) subscription is active.
drop policy if exists digital_pages_public_read on public.digital_pages;
create policy digital_pages_public_read on public.digital_pages
for select to anon, authenticated
using (
  status='PUBLISHED'
  and (
    owner_user_id is null
    or public.digital_page_public_subscription_active(digital_page_order_id)
  )
);

drop policy if exists digital_page_sections_public_read on public.digital_page_sections;
create policy digital_page_sections_public_read on public.digital_page_sections
for select to anon, authenticated
using (
  active=true and exists (
    select 1 from public.digital_pages p
    where p.id=digital_page_sections.page_id and p.status='PUBLISHED'
      and (
        p.owner_user_id is null
        or public.digital_page_public_subscription_active(p.digital_page_order_id)
      )
  )
);

-- Keep existing business/provider ownership and add the paid customer-owned path.
drop policy if exists digital_pages_owner_select on public.digital_pages;
create policy digital_pages_owner_select on public.digital_pages
for select to authenticated
using (
  (
    owner_user_id=(select auth.uid())
    and public.digital_page_subscription_active(digital_page_order_id,(select auth.uid()))
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
          and o.page_type=digital_pages.page_type
      )
      and public.digital_page_subscription_active(digital_page_order_id,(select auth.uid()))
    )
    or (business_id is not null and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
        and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
    ))
    or (provider_profile_id is not null and exists (
      select 1 from public.marketing_provider_profiles p
      where p.id=provider_profile_id and p.owner_user_id=(select auth.uid())
    ))
  )
);

drop policy if exists digital_pages_owner_update_draft on public.digital_pages;
create policy digital_pages_owner_update_draft on public.digital_pages
for update to authenticated
using (
  (
    owner_user_id=(select auth.uid())
    and public.digital_page_subscription_active(digital_page_order_id,(select auth.uid()))
    and (
      status <> 'PUBLISHED'
      or exists (
        select 1 from public.digital_page_orders o
        where o.id=digital_page_order_id and o.user_id=(select auth.uid())
          and o.fulfillment_status='PUBLISHED'
      )
    )
  )
  or (business_id is not null and status <> 'PUBLISHED' and exists (
    select 1 from public.user_memberships m
    where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
      and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
  ))
  or (provider_profile_id is not null and status <> 'PUBLISHED' and exists (
    select 1 from public.marketing_provider_profiles p
    where p.id=provider_profile_id and p.owner_user_id=(select auth.uid())
  ))
)
with check (
  updated_by=(select auth.uid())
  and (
    (
      owner_user_id=(select auth.uid()) and business_id is null and provider_profile_id is null
      and whatsapp_number is not null
      and public.digital_page_subscription_active(digital_page_order_id,(select auth.uid()))
      and (
        status <> 'PUBLISHED'
        or exists (
          select 1 from public.digital_page_orders o
          where o.id=digital_page_order_id and o.user_id=(select auth.uid())
            and o.fulfillment_status='PUBLISHED'
        )
      )
    )
    or (business_id is not null and status <> 'PUBLISHED' and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid()) and m.business_id=digital_pages.business_id
        and m.status='ACTIVE' and upper(coalesce(m.role,''))=any(array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
    ))
    or (provider_profile_id is not null and status <> 'PUBLISHED' and exists (
      select 1 from public.marketing_provider_profiles p
      where p.id=provider_profile_id and p.owner_user_id=(select auth.uid())
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
      (p.owner_user_id=(select auth.uid())
        and public.digital_page_subscription_active(p.digital_page_order_id,(select auth.uid())))
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
      (p.owner_user_id=(select auth.uid())
        and public.digital_page_subscription_active(p.digital_page_order_id,(select auth.uid())))
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
