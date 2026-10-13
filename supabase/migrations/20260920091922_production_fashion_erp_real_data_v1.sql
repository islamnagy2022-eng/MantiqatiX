
create table if not exists public.fashion_products (
 id text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 category_id text not null,
 category_name text not null,
 store_name text not null,
 price numeric(14,2) not null,
 original_price numeric(14,2),
 rating numeric(3,2) not null default 0,
 review_count integer not null default 0,
 image_url text not null default '',
 description text not null default '',
 available_sizes jsonb not null default '[]'::jsonb,
 available_colors jsonb not null default '[]'::jsonb,
 stock_count integer not null default 0,
 is_best_seller boolean not null default false,
 is_new_arrival boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.fashion_orders (
 order_id text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 product_name text not null,
 size text not null default '',
 color text not null default '',
 quantity integer not null default 1,
 total_price numeric(14,2) not null,
 customer_name text not null,
 phone text not null,
 address text not null,
 status text not null default 'NEW',
 date_formatted text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.fashion_products enable row level security;
alter table public.fashion_orders enable row level security;
drop policy if exists fashion_products_select on public.fashion_products;
create policy fashion_products_select on public.fashion_products for select to authenticated using (true);
drop policy if exists fashion_products_insert on public.fashion_products;
create policy fashion_products_insert on public.fashion_products for insert to authenticated with check (owner_user_id=auth.uid());
drop policy if exists fashion_products_update on public.fashion_products;
create policy fashion_products_update on public.fashion_products for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists fashion_products_delete on public.fashion_products;
create policy fashion_products_delete on public.fashion_products for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists fashion_orders_select on public.fashion_orders;
create policy fashion_orders_select on public.fashion_orders for select to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists fashion_orders_insert on public.fashion_orders;
create policy fashion_orders_insert on public.fashion_orders for insert to authenticated with check (owner_user_id=auth.uid());
drop policy if exists fashion_orders_update on public.fashion_orders;
create policy fashion_orders_update on public.fashion_orders for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
drop policy if exists fashion_orders_delete on public.fashion_orders;
create policy fashion_orders_delete on public.fashion_orders for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
grant select,insert,update,delete on public.fashion_products, public.fashion_orders to authenticated;
