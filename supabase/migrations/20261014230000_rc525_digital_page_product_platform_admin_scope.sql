-- RC525: only an explicitly scoped platform administrator may mutate the global digital-page catalog.
-- Forward-only security correction. Preserve public read access to active products.
-- Apply through the approved migration pipeline after disposable-database validation.
drop policy if exists digital_page_products_admin_write on public.digital_page_products;

create policy digital_page_products_platform_admin_write
  on public.digital_page_products
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_memberships m
      where m.user_id = (select auth.uid())
        and m.tenant_id = 'MNTY-PLATFORM'
        and m.status = 'ACTIVE'
        and upper(m.role) = 'SUPER_ADMIN'
        and coalesce(
          m.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb,
          false
        )
    )
  )
  with check (
    exists (
      select 1
      from public.user_memberships m
      where m.user_id = (select auth.uid())
        and m.tenant_id = 'MNTY-PLATFORM'
        and m.status = 'ACTIVE'
        and upper(m.role) = 'SUPER_ADMIN'
        and coalesce(
          m.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb,
          false
        )
    )
  );

comment on policy digital_page_products_platform_admin_write on public.digital_page_products is
  'RC525: only active MNTY-PLATFORM SUPER_ADMIN with explicit PLATFORM scope and full_control may mutate the global digital-page catalog.';
