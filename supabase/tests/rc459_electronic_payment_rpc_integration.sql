\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',false);
set role authenticated;

do $$
begin
 begin
  perform public.create_payment_intent_backend(
   'tenant-a','dddddddd-dddd-4ddd-8ddd-dddddddddddd',100,'EGP','PAYMOB','CARD','electronic-key-0001'
  );
  raise exception 'RC459_EXPECTED_ELECTRONIC_PAYMENT_REJECTION_MISSING';
 exception when others then
  if sqlerrm='RC459_EXPECTED_ELECTRONIC_PAYMENT_REJECTION_MISSING' then raise; end if;
  if position('ELECTRONIC_PAYMENTS_POST_LAUNCH' in sqlerrm)=0 then raise exception 'RC459_WRONG_REJECTION: %',sqlerrm; end if;
 end;
end $$;
reset role;

do $$
begin
 if (select count(*) from public.payment_intents) <> 0 then raise exception 'RC459_ELECTRONIC_INTENT_ROW_MUST_NOT_BE_CREATED'; end if;
 if not has_function_privilege('authenticated','public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE') then raise exception 'RC459_AUTHENTICATED_RPC_ACL_CHANGED'; end if;
 if has_function_privilege('anon','public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE') then raise exception 'RC459_ANON_EXECUTE_MUST_BE_DENIED'; end if;
 if not has_function_privilege('service_role','public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)','EXECUTE') then raise exception 'RC459_SERVICE_ROLE_ACL_CHANGED'; end if;
end $$;
select 'RC459 electronic payment RPC pre-launch gate: PASS' as result;
