-- RC570: enable safe restaurant-menu images and publish canonical branch menu into an active digital MENU page.
-- Candidate migration only. Do not apply to production until the full release gate passes.
alter table public.restaurant_menu_items
  add column if not exists image_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurant_menu_items'::regclass
      and conname = 'restaurant_menu_items_image_url_https_check'
  ) then
    alter table public.restaurant_menu_items
      add constraint restaurant_menu_items_image_url_https_check
      check (image_url is null or image_url ~* '^https://[^[:space:]]+$');
  end if;
end
$$;

comment on column public.restaurant_menu_items.image_url is
  'Optional HTTPS product image used by the public restaurant MENU page.';


-- Keep branch ownership binding private; never embed tenant/business/branch UUIDs in public section JSON.
create table if not exists public.digital_page_menu_branch_bindings (
  page_id uuid primary key references public.digital_pages(id) on delete cascade,
  tenant_id uuid not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.digital_page_menu_branch_bindings enable row level security;
revoke all on public.digital_page_menu_branch_bindings from public, anon, authenticated;
grant select, insert, update on public.digital_page_menu_branch_bindings to authenticated;

drop policy if exists digital_page_menu_branch_bindings_owner_read on public.digital_page_menu_branch_bindings;
create policy digital_page_menu_branch_bindings_owner_read
on public.digital_page_menu_branch_bindings
for select to authenticated
using (
  coalesce(public.mnty_can_platform_admin(), false)
  or exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = digital_page_menu_branch_bindings.tenant_id
      and m.business_id = digital_page_menu_branch_bindings.business_id
      and m.branch_id = digital_page_menu_branch_bindings.branch_id
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  )
);
drop policy if exists digital_page_menu_branch_bindings_owner_insert on public.digital_page_menu_branch_bindings;
create policy digital_page_menu_branch_bindings_owner_insert
on public.digital_page_menu_branch_bindings
for insert to authenticated
with check (
  coalesce(public.mnty_can_platform_admin(), false)
  or exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = digital_page_menu_branch_bindings.tenant_id
      and m.business_id = digital_page_menu_branch_bindings.business_id
      and m.branch_id = digital_page_menu_branch_bindings.branch_id
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  )
);
drop policy if exists digital_page_menu_branch_bindings_owner_update on public.digital_page_menu_branch_bindings;
create policy digital_page_menu_branch_bindings_owner_update
on public.digital_page_menu_branch_bindings
for update to authenticated
using (
  coalesce(public.mnty_can_platform_admin(), false)
  or exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = digital_page_menu_branch_bindings.tenant_id
      and m.business_id = digital_page_menu_branch_bindings.business_id
      and m.branch_id = digital_page_menu_branch_bindings.branch_id
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  )
)
with check (
  coalesce(public.mnty_can_platform_admin(), false)
  or exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = digital_page_menu_branch_bindings.tenant_id
      and m.business_id = digital_page_menu_branch_bindings.business_id
      and m.branch_id = digital_page_menu_branch_bindings.branch_id
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  )
);

create or replace function public.digital_page_menu_branch_binding_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $
begin
  if new.page_id is distinct from old.page_id
     or new.tenant_id is distinct from old.tenant_id
     or new.business_id is distinct from old.business_id
     or new.branch_id is distinct from old.branch_id then
    raise exception 'DIGITAL_PAGE_MENU_BRANCH_BINDING_IMMUTABLE';
  end if;
  return new;
end;
$;
drop trigger if exists trg_digital_page_menu_branch_binding_immutable on public.digital_page_menu_branch_bindings;
create trigger trg_digital_page_menu_branch_binding_immutable
before update on public.digital_page_menu_branch_bindings
for each row execute function public.digital_page_menu_branch_binding_immutable();
revoke all on function public.digital_page_menu_branch_binding_immutable() from public, anon, authenticated;

-- This SECURITY DEFINER predicate reads the private binding even when another branch's RLS hides it.
-- It is used only as a restrictive write policy; public readers can still read published MENU sections.
create or replace function public.digital_page_menu_section_write_allowed(p_page_id uuid, p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $
  select p_actor is not null
    and p_actor = auth.uid()
    and (
      coalesce(public.mnty_can_platform_admin(), false)
      or (
        not exists (
          select 1 from public.digital_page_menu_branch_bindings b
          where b.page_id = p_page_id
        )
        and exists (
          select 1
          from public.digital_pages p
          left join public.digital_page_orders o on o.id = p.digital_page_order_id
          where p.id = p_page_id
            and (p.digital_page_order_id is null or o.user_id = p_actor)
        )
      )
      or exists (
        select 1
        from public.digital_page_menu_branch_bindings b
        join public.user_memberships m
          on m.user_id = p_actor
         and m.tenant_id = b.tenant_id
         and m.business_id = b.business_id
         and m.branch_id = b.branch_id
         and m.status = 'ACTIVE'
         and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
        where b.page_id = p_page_id
      )
    );
$;
revoke all on function public.digital_page_menu_section_write_allowed(uuid, uuid) from public, anon;
grant execute on function public.digital_page_menu_section_write_allowed(uuid, uuid) to authenticated;

drop policy if exists digital_page_sections_menu_binding_insert on public.digital_page_sections;
create policy digital_page_sections_menu_binding_insert
on public.digital_page_sections as restrictive
for insert to authenticated
with check (
  section_type <> 'MENU'
  or public.digital_page_menu_section_write_allowed(page_id, auth.uid())
);
drop policy if exists digital_page_sections_menu_binding_update on public.digital_page_sections;
create policy digital_page_sections_menu_binding_update
on public.digital_page_sections as restrictive
for update to authenticated
using (
  section_type <> 'MENU'
  or public.digital_page_menu_section_write_allowed(page_id, auth.uid())
)
with check (
  section_type <> 'MENU'
  or public.digital_page_menu_section_write_allowed(page_id, auth.uid())
);
drop policy if exists digital_page_sections_menu_binding_delete on public.digital_page_sections;
create policy digital_page_sections_menu_binding_delete
on public.digital_page_sections as restrictive
for delete to authenticated
using (
  section_type <> 'MENU'
  or public.digital_page_menu_section_write_allowed(page_id, auth.uid())
);

comment on table public.digital_page_menu_branch_bindings is
  'Private branch binding for a published digital MENU page; intentionally not readable by anonymous visitors.';
