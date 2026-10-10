-- RC566: bind CRM manager reads to the selected business or explicit platform-admin scope.
-- Source-only until review, isolated tests, and approved production rollout.

DROP POLICY IF EXISTS "CRM managers view marketing leads" ON public.marketing_leads;
CREATE POLICY "CRM managers view marketing leads"
ON public.marketing_leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_memberships AS um
    WHERE um.user_id = auth.uid()
      AND um.status = 'ACTIVE'
      AND upper(coalesce(um.role, '')) IN ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
      AND (
        um.business_id = marketing_leads.requester_business_id
        OR (
          um.tenant_id = 'MNTY-PLATFORM'
          AND upper(coalesce(um.role, '')) = 'SUPER_ADMIN'
          AND coalesce(um.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb, false)
        )
      )
  )
);

DROP POLICY IF EXISTS "CRM managers view marketing providers" ON public.marketing_provider_profiles;
CREATE POLICY "CRM managers view marketing providers"
ON public.marketing_provider_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_memberships AS um
    WHERE um.user_id = auth.uid()
      AND um.status = 'ACTIVE'
      AND upper(coalesce(um.role, '')) IN ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
      AND (
        um.business_id = marketing_provider_profiles.business_id
        OR (
          um.tenant_id = 'MNTY-PLATFORM'
          AND upper(coalesce(um.role, '')) = 'SUPER_ADMIN'
          AND coalesce(um.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb, false)
        )
      )
  )
);
