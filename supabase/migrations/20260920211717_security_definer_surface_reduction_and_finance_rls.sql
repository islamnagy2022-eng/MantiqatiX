CREATE POLICY credit_accounts_finance_read
ON public.credit_accounts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = credit_accounts.tenant_id
      AND m.status = 'ACTIVE'
      AND (m.business_id = credit_accounts.business_id OR m.business_id IS NULL)
      AND m.role IN ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
  )
);

CREATE POLICY credit_periods_finance_read
ON public.credit_periods
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.credit_accounts a
    JOIN public.user_memberships m
      ON m.tenant_id = a.tenant_id
     AND m.user_id = auth.uid()
     AND m.status = 'ACTIVE'
     AND (m.business_id = a.business_id OR m.business_id IS NULL)
     AND m.role IN ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
    WHERE a.id = credit_periods.credit_account_id
  )
);

CREATE POLICY payment_provider_events_finance_read
ON public.payment_provider_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id = payment_provider_events.tenant_id
      AND m.status = 'ACTIVE'
      AND m.role IN ('OWNER','ADMIN','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
  )
);

CREATE POLICY settlement_attempts_finance_read
ON public.settlement_attempts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.financial_obligations o
    JOIN public.user_memberships m
      ON m.tenant_id = o.tenant_id
     AND m.user_id = auth.uid()
     AND m.status = 'ACTIVE'
     AND m.role IN ('OWNER','ADMIN','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
    WHERE o.id = settlement_attempts.obligation_id
  )
);

ALTER FUNCTION public.get_credit_status(character varying, uuid)
  SECURITY INVOKER
  SET search_path = public;
