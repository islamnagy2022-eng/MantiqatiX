\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','',false);
set role service_role;

do $$
begin
 begin
  perform public.confirm_cash_payment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222');
  raise exception 'RC460_CROSS_BUSINESS_CASH_CONFIRMATION_MUST_FAIL';
 exception when others then
  if sqlerrm='RC460_CROSS_BUSINESS_CASH_CONFIRMATION_MUST_FAIL' then raise; end if;
  if position('FORBIDDEN' in sqlerrm)=0 then raise exception 'RC460_WRONG_SCOPE_ERROR: %',sqlerrm; end if;
 end;
end $$;
reset role;

do $$
begin
 if (select status from public.payment_intents where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 'CREATED' then raise exception 'RC460_CROSS_BUSINESS_CONFIRMATION_MUTATED_PAYMENT'; end if;
 if (select count(*) from public.payment_events) <> 0 then raise exception 'RC460_CROSS_BUSINESS_CONFIRMATION_WROTE_EVENT'; end if;
end $$;

insert into public.user_memberships(user_id,tenant_id,business_id,role,permissions,status) values
('22222222-2222-4222-8222-222222222222','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','CUSTOM_OPERATOR','{"PAYMENT_CONFIRM_CASH":false}','ACTIVE');

set role service_role;
do $
begin
 begin
  perform public.confirm_cash_payment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222');
  raise exception 'RC460_FALSE_PERMISSION_MUST_NOT_GRANT';
 exception when others then
  if sqlerrm='RC460_FALSE_PERMISSION_MUST_NOT_GRANT' then raise; end if;
  if position('FORBIDDEN' in sqlerrm)=0 then raise exception 'RC460_FALSE_PERMISSION_WRONG_ERROR: %',sqlerrm; end if;
 end;
end $;
reset role;
do $
begin
 if (select status from public.payment_intents where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 'CREATED' then raise exception 'RC460_FALSE_PERMISSION_MUTATED_PAYMENT'; end if;
 if (select count(*) from public.payment_events) <> 0 then raise exception 'RC460_FALSE_PERMISSION_WROTE_EVENT'; end if;
end $;

update public.user_memberships
set permissions='{"PAYMENT_CONFIRM_CASH":true}'::jsonb
where user_id='22222222-2222-4222-8222-222222222222'
  and tenant_id='tenant-a'
  and business_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and role='CUSTOM_OPERATOR';
do $$
declare result jsonb;
begin
 result:=public.confirm_cash_payment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222');
 if result->>'status'<>'success' then raise exception 'RC460_VALID_CASH_CONFIRMATION_FAILED'; end if;
 if result#>>'{commission_obligation,amount}'<>'10.00' then raise exception 'RC460_COMMISSION_AMOUNT_FAILED'; end if;
 result:=public.confirm_cash_payment('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','22222222-2222-4222-8222-222222222222');
 if result->>'status'<>'success' OR result->>'message'<>'Already confirmed' then raise exception 'RC460_AUTHORIZED_IDEMPOTENT_RETRY_FAILED'; end if;
end $$;
reset role;

do $$
begin
 if (select status from public.payment_intents where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 'SUCCEEDED' then raise exception 'RC460_PAYMENT_STATUS_NOT_UPDATED'; end if;
 if (select count(*) from public.payment_events) <> 1 then raise exception 'RC460_PAYMENT_EVENT_NOT_ATOMIC'; end if;
 if (select count(*) from public.financial_obligations where id='cash_commission:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and amount=10) <> 1 then raise exception 'RC460_COMMISSION_OBLIGATION_MISSING'; end if;
 if (select count(*) from public.financial_obligations where payment_intent_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 1 then raise exception 'RC460_DUPLICATE_COMMISSION_OBLIGATION_ON_RETRY'; end if;
 if has_function_privilege('anon','public.confirm_cash_payment(character varying,uuid)','EXECUTE') then raise exception 'RC460_ANON_EXECUTE_MUST_BE_DENIED'; end if;
 if has_function_privilege('authenticated','public.confirm_cash_payment(character varying,uuid)','EXECUTE') then raise exception 'RC460_AUTHENTICATED_EXECUTE_MUST_BE_DENIED'; end if;
 if not has_function_privilege('service_role','public.confirm_cash_payment(character varying,uuid)','EXECUTE') then raise exception 'RC460_SERVICE_ROLE_ACL_REQUIRED'; end if;
end $$;
select 'RC460 cash confirmation business scope integration: PASS' as result;
