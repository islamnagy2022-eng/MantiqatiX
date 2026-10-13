
create table if not exists public.restaurant_menu_items (
 id text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name_ar text not null,
 description_ar text not null default '',
 base_price_egp numeric(14,2) not null,
 original_price_egp numeric(14,2),
 category text not null,
 is_available boolean not null default true,
 is_popular boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.restaurant_menu_items enable row level security;
drop policy if exists restaurant_menu_items_select on public.restaurant_menu_items;
create policy restaurant_menu_items_select on public.restaurant_menu_items for select to authenticated using (is_available or owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists restaurant_menu_items_insert on public.restaurant_menu_items;
create policy restaurant_menu_items_insert on public.restaurant_menu_items for insert to authenticated with check (owner_user_id=auth.uid());
drop policy if exists restaurant_menu_items_update on public.restaurant_menu_items;
create policy restaurant_menu_items_update on public.restaurant_menu_items for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists restaurant_menu_items_delete on public.restaurant_menu_items;
create policy restaurant_menu_items_delete on public.restaurant_menu_items for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
grant select,insert,update,delete on public.restaurant_menu_items to authenticated;
