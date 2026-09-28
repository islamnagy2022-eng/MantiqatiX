-- Authenticated-read policies must explicitly exclude anonymous Auth sessions.
-- Keep access for verified/non-anonymous sessions while preventing anon-session reads.
drop policy if exists business_categories_authenticated_read on public.business_categories;
create policy business_categories_authenticated_read on public.business_categories for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists business_sectors_authenticated_read on public.business_sectors;
create policy business_sectors_authenticated_read on public.business_sectors for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists fashion_products_select on public.fashion_products;
create policy fashion_products_select on public.fashion_products for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists matrimony_profiles_select on public.matrimony_profiles;
create policy matrimony_profiles_select on public.matrimony_profiles for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists modules_authenticated_read on public.modules;
create policy modules_authenticated_read on public.modules for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists brand_identity_authenticated_read on public.platform_brand_identity;
create policy brand_identity_authenticated_read on public.platform_brand_identity for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists used_item_ads_select_authenticated on public.used_item_ads;
create policy used_item_ads_select_authenticated on public.used_item_ads for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
drop policy if exists used_item_category_fees_select_authenticated on public.used_item_category_fees;
create policy used_item_category_fees_select_authenticated on public.used_item_category_fees for select to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
