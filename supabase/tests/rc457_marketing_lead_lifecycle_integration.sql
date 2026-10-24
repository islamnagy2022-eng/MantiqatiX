-- RC457 behavioral integration test. Run only in disposable PostgreSQL.
set role authenticated;
do $test$
declare
  manager_a uuid := '30000000-0000-4000-8000-000000000011';
  manager_b uuid := '30000000-0000-4000-8000-000000000012';
  business_a uuid := '30000000-0000-4000-8000-000000000001';
  lead_a uuid := '50000000-0000-4000-8000-000000000001';
  lead_b uuid := '50000000-0000-4000-8000-000000000002';
  request_a uuid := '60000000-0000-4000-8000-000000000001';
  result jsonb;
  rejected boolean;
begin
  perform set_config('request.jwt.claim.sub', manager_a::text, false);
  perform set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',manager_a::text,'is_anonymous',false)::text, false);

  result := public.transition_marketing_lead_backend(manager_a,lead_a,'OPEN','CONTACT_ATTEMPTED',request_a);
  if result->>'status' <> 'CONTACT_ATTEMPTED' or coalesce((result->>'idempotent')::boolean,true) then
    raise exception 'valid lead transition did not return a first-write success';
  end if;
  if (select status from public.marketing_leads where id=lead_a) <> 'CONTACT_ATTEMPTED' then
    raise exception 'lead status was not persisted';
  end if;
  if (select count(*) from public.audit_logs where entity_type='MARKETING_LEAD' and entity_id=lead_a::text and action='MARKETING_LEAD_STATUS_CHANGED') <> 1 then
    raise exception 'lead transition audit was not written exactly once';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where entity_type='MARKETING_LEAD' and entity_id=lead_a::text
      and action='MARKETING_LEAD_STATUS_CHANGED'
      and tenant_id='TENANT-A' and organization_id='ORG-A' and business_id=business_a
      and actor_user_id=manager_a and result='SUCCESS'
      and old_values->>'status'='OPEN'
      and new_values->>'status'='CONTACT_ATTEMPTED'
      and new_values->>'request_id'=request_a::text
  ) then raise exception 'lead audit is missing actor/scope/transition metadata'; end if;
  if exists (
    select 1 from public.audit_logs
    where entity_type='MARKETING_LEAD' and entity_id=lead_a::text
      and action='MARKETING_LEAD_STATUS_CHANGED'
      and (new_values ? 'notes' or new_values ? 'email' or new_values ? 'phone')
  ) then raise exception 'lead lifecycle audit contains unexpected free-text/contact fields'; end if;

  result := public.transition_marketing_lead_backend(manager_a,lead_a,'OPEN','CONTACT_ATTEMPTED',request_a);
  if coalesce((result->>'idempotent')::boolean,false) is not true then
    raise exception 'identical lifecycle replay was not idempotent';
  end if;
  if (select count(*) from public.audit_logs where entity_type='MARKETING_LEAD' and entity_id=lead_a::text and action='MARKETING_LEAD_STATUS_CHANGED') <> 1 then
    raise exception 'idempotent replay duplicated audit';
  end if;

  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_a,lead_a,'OPEN','CONTACTED',request_a);
  exception when others then
    if sqlerrm='LEAD_IDEMPOTENCY_KEY_CONFLICT' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'idempotency key reused for a different transition was accepted'; end if;

  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_a,lead_a,'OPEN','CONTACTED','60000000-0000-4000-8000-000000000002');
  exception when others then
    if sqlerrm='LEAD_STATUS_CONFLICT' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'stale expected status was accepted'; end if;

  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_a,lead_a,'CONTACT_ATTEMPTED','CONVERTED','60000000-0000-4000-8000-000000000003');
  exception when others then
    if sqlerrm='LEAD_TRANSITION_NOT_ALLOWED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'disallowed lifecycle transition was accepted'; end if;

  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_a,lead_a,'CONTACT_ATTEMPTED','UNKNOWN','60000000-0000-4000-8000-000000000004');
  exception when others then
    if sqlerrm='LEAD_STATUS_INVALID' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'unknown destination status was accepted'; end if;

  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_b,lead_a,'CONTACT_ATTEMPTED','CONTACTED','60000000-0000-4000-8000-000000000005');
  exception when others then
    if sqlerrm='ACTOR_MISMATCH' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'actor spoofing was accepted'; end if;

  perform set_config('request.jwt.claim.sub', manager_b::text, false);
  perform set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',manager_b::text,'is_anonymous',false)::text, false);
  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_b,lead_a,'CONTACT_ATTEMPTED','CONTACTED','60000000-0000-4000-8000-000000000006');
  exception when others then
    if sqlerrm='LEAD_NOT_FOUND_OR_FORBIDDEN' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-business manager changed another business lead'; end if;

  perform set_config('request.jwt.claim.sub','',false);
  perform set_config('request.jwt.claims','{}',false);
  rejected:=false;
  begin
    perform public.transition_marketing_lead_backend(manager_a,lead_a,'CONTACT_ATTEMPTED','CONTACTED','60000000-0000-4000-8000-000000000007');
  exception when others then
    if sqlerrm='AUTH_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'missing authentication was accepted'; end if;

  if has_function_privilege('anon','public.transition_marketing_lead_backend(uuid,uuid,text,text,uuid)','EXECUTE') then
    raise exception 'anon can execute lead lifecycle RPC';
  end if;
  if not has_function_privilege('authenticated','public.transition_marketing_lead_backend(uuid,uuid,text,text,uuid)','EXECUTE') then
    raise exception 'authenticated cannot execute lead lifecycle RPC';
  end if;
end;
$test$;
reset role;
select 'RC457 marketing lead lifecycle integration: PASS' as result;
