CREATE OR REPLACE FUNCTION public.get_credit_status(p_tenant_id character varying, p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  a public.credit_accounts%rowtype;
  p public.credit_periods%rowtype;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') = 'true' THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.user_id = v_uid
      AND m.tenant_id = p_tenant_id
      AND m.status = 'ACTIVE'
      AND (
        m.business_id = p_business_id
        OR m.business_id IS NULL
      )
      AND m.role IN (
        'OWNER',
        'ADMIN',
        'MANAGER',
        'FINANCE',
        'ACCOUNTANT',
        'FINANCE_MANAGER'
      )
  ) THEN
    RAISE EXCEPTION 'credit_status_forbidden';
  END IF;

  SELECT *
  INTO a
  FROM public.credit_accounts
  WHERE tenant_id = p_tenant_id
    AND business_id = p_business_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_account_not_found';
  END IF;

  SELECT *
  INTO p
  FROM public.credit_periods
  WHERE credit_account_id = a.id
  ORDER BY due_date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'account_id', a.id,
    'approved_limit', a.approved_limit,
    'outstanding_amount', a.outstanding_amount,
    'available_amount', a.available_amount,
    'status', a.status,
    'next_due_date', a.next_due_date,
    'current_period',
      CASE
        WHEN p.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'period_start', p.period_start,
          'period_end', p.period_end,
          'due_date', p.due_date,
          'billed_amount', p.billed_amount,
          'paid_amount', p.paid_amount,
          'outstanding_amount', p.outstanding_amount,
          'status', p.status,
          'days_overdue', p.days_overdue
        )
      END
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.get_credit_status(character varying, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_credit_status(character varying, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_credit_status(character varying, uuid) TO authenticated;
