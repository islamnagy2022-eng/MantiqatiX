-- Harden the identity boundary: every authenticated-role policy on the core
-- tenant/business hierarchy must explicitly reject anonymous-auth sessions.
ALTER POLICY tenants_select_member ON public.tenants
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = tenants.id::text
        AND um.status = 'ACTIVE'
    )
  );

ALTER POLICY organizations_member_read ON public.organizations
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = organizations.tenant_id::text
        AND um.status = 'ACTIVE'
    )
  );

ALTER POLICY organizations_admin_write ON public.organizations
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = organizations.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN']::text[])
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = organizations.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN']::text[])
    )
  );

ALTER POLICY businesses_member_select ON public.businesses
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = businesses.tenant_id::text
        AND um.status = 'ACTIVE'
    )
  );

ALTER POLICY businesses_manager_insert ON public.businesses
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = businesses.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN','MANAGER']::text[])
    )
  );

ALTER POLICY businesses_manager_update ON public.businesses
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = businesses.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN','MANAGER']::text[])
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = businesses.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN','MANAGER']::text[])
    )
  );

ALTER POLICY businesses_manager_delete ON public.businesses
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = businesses.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN','MANAGER']::text[])
    )
  );

ALTER POLICY branches_member_read ON public.branches
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = branches.tenant_id::text
        AND um.status = 'ACTIVE'
    )
  );

ALTER POLICY branches_manager_write ON public.branches
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = branches.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN','MANAGER']::text[])
    )
  )
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM public.user_memberships um
      WHERE um.user_id = auth.uid()
        AND um.tenant_id::text = branches.tenant_id::text
        AND um.status = 'ACTIVE'
        AND um.role = ANY (ARRAY['OWNER','ADMIN','MANAGER']::text[])
    )
  );

ALTER POLICY memberships_select_self ON public.user_memberships
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
    AND auth.uid() = user_id
  );
