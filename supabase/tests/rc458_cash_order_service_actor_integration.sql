\\set ON_ERROR_STOP on
select set_config('request.jwt.claim.role','service_role',false);
select set_config('request.jwt.claim.sub','',false);
set role service_role;

do $$
declare
 first_result jsonb;
 replay_result jsonb;
begin
 first_result := public.create_order_backend(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
  '11111111-1111-4111-8111-111111111111','cash-order-key-0001',0,0,0,0,0,'EGP',
  'Test Customer','01000000000','Test address',
  '[{"catalogItemId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","quantity":2,"selectedOptionIds":[]}]'::jsonb,
  null,'{}'::jsonb
 );
 replay_result := public.create_order_backend(
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
  '11111111-1111-4111-8111-111111111111','cash-order-key-0001',0,0,0,0,0,'EGP',
  'Test Customer','01000000000','Test address',
  '[{"catalogItemId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","quantity":2,"selectedOptionIds":[]}]'::jsonb,
  null,'{}'::jsonb
 );
 if first_result->>'id' <> 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then raise exception 'RC458_ORDER_ID_MISMATCH'; end if;
 if replay_result->>'id' <> first_result->>'id' or replay_result->>'idempotent' <> 'true' then raise exception 'RC458_IDEMPOTENCY_REPLAY_FAILED'; end if;
 begin
  perform public.create_order_backend(
   'ffffffff-ffff-4fff-8fff-ffffffffffff','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,
   '99999999-9999-4999-8999-999999999999','cash-order-key-0002',0,0,0,0,0,'EGP',
   'Unmembered Customer','01000000000','Test address',
   '[{"catalogItemId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","quantity":1,"selectedOptionIds":[]}]'::jsonb,
   null,'{}'::jsonb
  );
  raise exception 'RC458_EXPECTED_MEMBERSHIP_REJECTION_MISSING';
 exception when others then
  if sqlerrm='RC458_EXPECTED_MEMBERSHIP_REJECTION_MISSING' then raise; end if;
  if position('CUSTOMER_MEMBERSHIP_REQUIRED' in sqlerrm)=0 then raise exception 'RC458_WRONG_MEMBERSHIP_ERROR: %',sqlerrm; end if;
 end;
end $$;
reset role;

do $$
begin
 if (select total_amount from public.orders where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 251.00 then raise exception 'RC458_SERVER_PRICE_CALCULATION_FAILED'; end if;
 if (select status from public.orders where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') <> 'PENDING' then raise exception 'RC458_ORDER_STATUS_FAILED'; end if;
 if has_function_privilege('anon','public.create_order_backend(uuid,character varying,uuid,character varying,uuid,character varying,numeric,numeric,numeric,numeric,numeric,character varying,text,text,text,jsonb,text,jsonb)','EXECUTE') then raise exception 'RC458_ANON_EXECUTE_MUST_BE_DENIED'; end if;
 if has_function_privilege('authenticated','public.create_order_backend(uuid,character varying,uuid,character varying,uuid,character varying,numeric,numeric,numeric,numeric,numeric,character varying,text,text,text,jsonb,text,jsonb)','EXECUTE') then raise exception 'RC458_AUTHENTICATED_EXECUTE_MUST_BE_DENIED'; end if;
 if not has_function_privilege('service_role','public.create_order_backend(uuid,character varying,uuid,character varying,uuid,character varying,numeric,numeric,numeric,numeric,numeric,character varying,text,text,text,jsonb,text,jsonb)','EXECUTE') then raise exception 'RC458_SERVICE_ROLE_EXECUTE_REQUIRED'; end if;
end $$;
select 'RC458 cash order service-role actor integration: PASS' as result;
