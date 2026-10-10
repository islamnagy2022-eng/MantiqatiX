-- RC567 behavioral tests. Run only in disposable PostgreSQL.
INSERT INTO public.user_memberships(id,user_id,tenant_id,role,status)
VALUES ('member','10000000-0000-4000-8000-000000005671','TENANT-A','MEMBER','ACTIVE');
INSERT INTO public.approval_requests(id,tenant_id,requested_by,status)
VALUES ('approval-1','TENANT-A','10000000-0000-4000-8000-000000005671','PENDING');

DO $acl$
DECLARE
  policy_exists boolean;
BEGIN
  IF has_table_privilege('authenticated','public.approval_actions','INSERT') THEN
    RAISE EXCEPTION 'authenticated INSERT must be revoked';
  END IF;
  IF NOT has_table_privilege('service_role','public.approval_actions','INSERT') THEN
    RAISE EXCEPTION 'trusted service_role write privilege must be preserved';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='approval_actions'
      AND policyname='approval_actions_member_insert'
  ) INTO policy_exists;
  IF policy_exists THEN RAISE EXCEPTION 'legacy member INSERT policy must be removed'; END IF;
END;
$acl$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000005671',false);
SET ROLE authenticated;
DO $negative$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.approval_actions(id,approval_request_id,action,acted_by,comment)
    VALUES ('forged-action','approval-1','APPROVED',auth.uid(),'forged audit action');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'ordinary authenticated member inserted an approval action'; END IF;
END;
$negative$;
RESET ROLE;

DO $postcheck$
BEGIN
  IF EXISTS (SELECT 1 FROM public.approval_actions WHERE id='forged-action') THEN
    RAISE EXCEPTION 'unauthorized approval action row persisted';
  END IF;
END;
$postcheck$;

SELECT 'RC567 approval action write boundary integration: PASS' AS result;
