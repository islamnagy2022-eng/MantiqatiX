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
grant select, insert, update, delete on public.digital_page_menu_branch_bindings to authenticated;

drop policy if exists digital_page_menu_branch_bindings_owner_manage on public.digital_page_menu_branch_bindings;
create policy digital_page_menu_branch_bindings_owner_manage
on public.digital_page_menu_branch_bindings
for all to authenticated
using (
  exists (
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
  exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = digital_page_menu_branch_bindings.tenant_id
      and m.business_id = digital_page_menu_branch_bindings.business_id
      and m.branch_id = digital_page_menu_branch_bindings.branch_id
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  )
);

comment on table public.digital_page_menu_branch_bindings is
  'Private branch binding for a published digital MENU page; intentionally not readable by anonymous visitors.';
