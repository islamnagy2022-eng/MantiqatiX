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

