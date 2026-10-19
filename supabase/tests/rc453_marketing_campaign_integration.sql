-- RC453 behavioral integration test. Run only in disposable PostgreSQL.
set role authenticated;
do $test$
declare
  manager_a uuid := '30000000-0000-4000-8000-000000000011';
  manager_b uuid := '30000000-0000-4000-8000-000000000012';
  tenant_super_c uuid := '30000000-0000-4000-8000-000000000013';
  platform_admin uuid := '30000000-0000-4000-8000-000000000014';
  provider_b uuid := '30000000-0000-4000-8000-000000000015';
  customer_b uuid := '30000000-0000-4000-8000-000000000016';
  business_a uuid := '30000000-0000-4000-8000-000000000001';
  business_b uuid := '30000000-0000-4000-8000-000000000002';
  business_c uuid := '30000000-0000-4000-8000-000000000003';
  campaign_a uuid;
  campaign_b uuid;
  platform_campaign uuid;
  participant_id uuid;
  result jsonb;
  rejected boolean;
begin
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  perform set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',manager_a::text,'is_anonymous',true)::text,false);
  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(
      manager_a,business_a,'Anonymous Campaign','LEADS',array['META'],100,'anonymous-key-0001','EGP',null,null,'{}'::jsonb,null
    );
  exception when others then
    if sqlerrm='AUTH_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'anonymous Auth session created a campaign'; end if;
  perform set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',manager_a::text,'is_anonymous',false)::text,false);

  result := public.create_marketing_campaign_backend(
    manager_a,business_a,'Cairo Launch','LEADS',array['meta','Google'],1000,'campaign-a-key-0001','egp',
    pg_catalog.now()+interval '1 day',pg_catalog.now()+interval '10 days',
    '{"region":"Cairo","language":"ar"}'::jsonb,'Campaign brief'
  );
  campaign_a := (result->>'campaign_id')::uuid;
  if result->>'status' <> 'DRAFT' or result->>'idempotent' <> 'false' then raise exception 'campaign creation did not return draft success'; end if;
  if (select status from public.marketing_campaigns where id=campaign_a) <> 'DRAFT'
     or (select tenant_id from public.marketing_campaigns where id=campaign_a) <> 'TENANT-A'
     or (select channels from public.marketing_campaigns where id=campaign_a) <> array['GOOGLE','META'] then
    raise exception 'campaign persisted with unexpected tenant/status/channels';
  end if;
  if (select count(*) from public.audit_logs where action='MARKETING_CAMPAIGN_CREATED' and entity_id=campaign_a::text) <> 1 then
    raise exception 'campaign creation audit missing';
  end if;
  result := public.create_marketing_campaign_backend(
    manager_a,business_a,'Cairo Launch','LEADS',array['meta','Google'],1000,'campaign-a-key-0001','egp',
    pg_catalog.now()+interval '1 day',pg_catalog.now()+interval '10 days',
    '{"region":"Cairo","language":"ar"}'::jsonb,'Campaign brief'
  );
  if (result->>'campaign_id')::uuid <> campaign_a or coalesce((result->>'idempotent')::boolean,false) is not true then
    raise exception 'campaign creation replay was not idempotent';
  end if;
  if (select count(*) from public.audit_logs where action='MARKETING_CAMPAIGN_CREATED' and entity_id=campaign_a::text) <> 1 then
    raise exception 'campaign creation replay duplicated audit';
  end if;

  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(
      manager_a,business_a,'Changed Launch','LEADS',array['META','GOOGLE'],1500,'campaign-a-key-0001','EGP',
      pg_catalog.now()+interval '1 day',pg_catalog.now()+interval '10 days',
      '{"region":"Cairo","language":"ar"}'::jsonb,'Campaign brief'
    );
  exception when others then
    if sqlerrm='MARKETING_IDEMPOTENCY_KEY_CONFLICT' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'same idempotency key with a different payload was accepted'; end if;
  if (select count(*) from public.marketing_campaigns where business_id=business_a and idempotency_key='campaign-a-key-0001') <> 1 then
    raise exception 'idempotency conflict created a duplicate campaign';
  end if;

  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(manager_a,business_b,'Cross Tenant','LEADS',array['META'],100,'cross-tenant-key-01','EGP',null,null,'{}'::jsonb,null);
  exception when others then
    if sqlerrm='MARKETING_BUSINESS_SCOPE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'manager A created campaign for tenant B'; end if;

  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(manager_b,business_a,'Spoof Actor','LEADS',array['META'],100,'spoof-actor-key-01','EGP',null,null,'{}'::jsonb,null);
  exception when others then
    if sqlerrm='ACTOR_MISMATCH' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'campaign actor spoofing was accepted'; end if;

  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(manager_a,business_a,'Bad Channel','LEADS',array['MALWARE'],100,'bad-channel-key-01','EGP',null,null,'{}'::jsonb,null);
  exception when others then
    if sqlerrm='MARKETING_CHANNEL_INVALID' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'unsupported channel was accepted'; end if;

  perform set_config('request.jwt.claim.sub',manager_b::text,false);
  result := public.create_marketing_campaign_backend(
    manager_b,business_b,'Agency B Campaign','AWARENESS',array['TIKTOK'],500,'campaign-b-key-0001','EGP',
    pg_catalog.now()+interval '2 days',pg_catalog.now()+interval '8 days','{}'::jsonb,null
  );
  campaign_b := (result->>'campaign_id')::uuid;

  perform set_config('request.jwt.claim.sub',tenant_super_c::text,false);
  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(tenant_super_c,business_a,'Tenant Super Spoof','LEADS',array['META'],100,'tenant-super-key-001','EGP',null,null,'{}'::jsonb,null);
  exception when others then
    if sqlerrm='MARKETING_BUSINESS_SCOPE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'tenant-scoped SUPER_ADMIN gained platform campaign access'; end if;

  perform set_config('request.jwt.claim.sub',platform_admin::text,false);
  result := public.create_marketing_campaign_backend(
    platform_admin,business_b,'Platform Campaign','TRAFFIC',array['GOOGLE'],250,'platform-key-0001','EGP',
    pg_catalog.now()+interval '1 day',pg_catalog.now()+interval '3 days','{}'::jsonb,null
  );
  platform_campaign := (result->>'campaign_id')::uuid;
  if not exists(select 1 from public.marketing_campaigns where id=campaign_a)
     or not exists(select 1 from public.marketing_campaigns where id=campaign_b) then
    raise exception 'explicit platform admin could not read platform-scoped campaign records';
  end if;

  -- Only verified, active partner-company/freelancer profiles can be invited.
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  rejected:=false;
  begin
    perform public.invite_marketing_campaign_partner_backend(manager_a,campaign_a,'40000000-0000-4000-8000-000000000002','MEDIA_BUYING',10,100);
  exception when others then
    if sqlerrm='MARKETING_PARTNER_NOT_ELIGIBLE' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'unverified provider was invited'; end if;

  result := public.invite_marketing_campaign_partner_backend(manager_a,campaign_a,'40000000-0000-4000-8000-000000000001','MEDIA_BUYING',40,250);
  participant_id := (result->>'participant_id')::uuid;
  if result->>'status' <> 'INVITED' or result->>'idempotent' <> 'false' then raise exception 'partner invitation failed'; end if;
  if (select count(*) from public.notifications where user_id=provider_b and type='MARKETING_CAMPAIGN_INVITATION') <> 1 then raise exception 'partner invitation notification missing'; end if;
  result := public.invite_marketing_campaign_partner_backend(manager_a,campaign_a,'40000000-0000-4000-8000-000000000001','MEDIA_BUYING',40,250);
  if coalesce((result->>'idempotent')::boolean,false) is not true then raise exception 'duplicate partner invitation was not idempotent'; end if;
  if (select count(*) from public.notifications where user_id=provider_b and type='MARKETING_CAMPAIGN_INVITATION') <> 1 then raise exception 'replayed invitation duplicated notification'; end if;

  rejected:=false;
  begin
    perform public.invite_marketing_campaign_partner_backend(manager_a,campaign_a,'40000000-0000-4000-8000-000000000003','ANALYTICS',70,100);
  exception when others then
    if sqlerrm='MARKETING_ALLOCATION_OVER_100' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'partner allocations exceeded 100 percent'; end if;

  -- A provider sees only campaigns for which they have an invitation/assignment.
  perform set_config('request.jwt.claim.sub',provider_b::text,false);
  if not exists(select 1 from public.marketing_campaigns where id=campaign_a) then raise exception 'invited provider cannot read invited campaign'; end if;
  if exists(select 1 from public.marketing_campaigns where id=campaign_b) then raise exception 'provider saw unassigned campaign in own business'; end if;
  if not exists(select 1 from public.marketing_campaign_participants where id=participant_id) then raise exception 'invited provider cannot read own invitation'; end if;

  rejected:=false;
  begin
    perform public.update_marketing_campaign_status_backend(provider_b,campaign_a,'CANCELLED');
  exception when others then
    if sqlerrm='MARKETING_BUSINESS_SCOPE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'provider changed client campaign status'; end if;

  result := public.respond_marketing_campaign_invitation_backend(provider_b,participant_id,'ACCEPTED');
  if result->>'status' <> 'ACCEPTED' then raise exception 'provider acceptance failed'; end if;
  if (select count(*) from public.notifications where user_id=manager_a and type='MARKETING_CAMPAIGN_PARTNER_RESPONSE') <> 1 then raise exception 'campaign owner response notification missing'; end if;
  result := public.respond_marketing_campaign_invitation_backend(provider_b,participant_id,'ACCEPTED');
  if coalesce((result->>'idempotent')::boolean,false) is not true then raise exception 'replayed partner acceptance was not idempotent'; end if;
  if (select count(*) from public.notifications where user_id=manager_a and type='MARKETING_CAMPAIGN_PARTNER_RESPONSE') <> 1 then raise exception 'replayed acceptance duplicated notification'; end if;

  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  result := public.update_marketing_campaign_status_backend(manager_a,campaign_a,'PLANNED');
  if result->>'status' <> 'PLANNED' then raise exception 'DRAFT to PLANNED transition failed'; end if;
  rejected:=false;
  begin
    perform public.update_marketing_campaign_status_backend(manager_a,campaign_a,'APPROVED');
  exception when others then
    if sqlerrm='MARKETING_STATUS_TRANSITION_INVALID' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'invalid PLANNED to APPROVED transition was accepted'; end if;
  perform public.update_marketing_campaign_status_backend(manager_a,campaign_a,'IN_REVIEW');
  result := public.update_marketing_campaign_status_backend(manager_a,campaign_a,'APPROVED');
  if result->>'status' <> 'APPROVED' then raise exception 'internal approval transition failed'; end if;
  result := public.update_marketing_campaign_status_backend(manager_a,campaign_a,'APPROVED');
  if coalesce((result->>'idempotent')::boolean,false) is not true then raise exception 'same-status update was not idempotent'; end if;
  rejected:=false;
  begin
    perform public.update_marketing_campaign_status_backend(manager_a,campaign_a,'DRAFT');
  exception when others then
    if sqlerrm='MARKETING_STATUS_TRANSITION_INVALID' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'terminally approved campaign was rolled back to draft'; end if;

  -- RC455/RC456: terminal campaigns cannot retain active partner assignments.
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  rejected:=false;
  begin
    perform public.update_marketing_campaign_status_backend(manager_a,campaign_a,'CANCELLED');
  exception when others then
    if sqlerrm='MARKETING_PARTICIPANTS_MUST_BE_CLOSED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'terminal campaign transition accepted while partner assignment remained active'; end if;

  -- RC456 authorization regressions: another tenant manager cannot close this
  -- participant, and the supplied actor cannot differ from auth.uid().
  perform set_config('request.jwt.claim.sub',manager_b::text,false);
  rejected:=false;
  begin
    perform public.close_marketing_campaign_partner_backend(manager_b,participant_id,'Cross-tenant attempt');
  exception when others then
    if sqlerrm='MARKETING_BUSINESS_SCOPE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-tenant manager closed another business partner assignment'; end if;

  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  rejected:=false;
  begin
    perform public.close_marketing_campaign_partner_backend(manager_b,participant_id,'Spoof actor attempt');
  exception when others then
    if sqlerrm='ACTOR_MISMATCH' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'partner closure accepted a spoofed actor'; end if;

  -- RC456 input-boundary regression: overlong reasons must fail before any
  -- participant state, audit record, or provider notification is changed.
  rejected:=false;
  begin
    perform public.close_marketing_campaign_partner_backend(manager_a,participant_id,pg_catalog.repeat('x',501));
  exception when others then
    if sqlerrm='MARKETING_PARTNER_CLOSURE_REASON_TOO_LONG' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'partner closure accepted a reason longer than 500 characters'; end if;
  if (select status from public.marketing_campaign_participants where id=participant_id) <> 'ACCEPTED' then
    raise exception 'overlong closure reason changed participant status';
  end if;
  if (select count(*) from public.audit_logs where action='MARKETING_PARTNER_ASSIGNMENT_CLOSED' and entity_id=participant_id::text) <> 0
     or (select count(*) from public.notifications where user_id=provider_b and type='MARKETING_PARTNER_ASSIGNMENT_CLOSED') <> 0 then
    raise exception 'overlong closure reason produced audit or notification side effects';
  end if;

  result := public.close_marketing_campaign_partner_backend(manager_a,participant_id,'  Integration test closure  ');
  if result->>'status' <> 'REMOVED' or coalesce((result->>'idempotent')::boolean,false) then
    raise exception 'manager partner closure did not remove the assignment';
  end if;
  if (select count(*) from public.audit_logs where action='MARKETING_PARTNER_ASSIGNMENT_CLOSED' and entity_id=participant_id::text) <> 1 then
    raise exception 'partner closure audit event missing or duplicated';
  end if;
  if (select new_values->>'reason' from public.audit_logs where action='MARKETING_PARTNER_ASSIGNMENT_CLOSED' and entity_id=participant_id::text) is distinct from 'Integration test closure' then
    raise exception 'partner closure audit did not store the trimmed reason';
  end if;
  if (select count(*) from public.notifications where user_id=provider_b and type='MARKETING_PARTNER_ASSIGNMENT_CLOSED') <> 1 then
    raise exception 'partner closure notification missing';
  end if;
  result := public.close_marketing_campaign_partner_backend(manager_a,participant_id,'Integration test closure replay');
  if coalesce((result->>'idempotent')::boolean,false) is not true then
    raise exception 'partner closure replay was not idempotent';
  end if;
  if (select count(*) from public.audit_logs where action='MARKETING_PARTNER_ASSIGNMENT_CLOSED' and entity_id=participant_id::text) <> 1
     or (select count(*) from public.notifications where user_id=provider_b and type='MARKETING_PARTNER_ASSIGNMENT_CLOSED') <> 1 then
    raise exception 'partner closure replay duplicated audit or notification';
  end if;
  result := public.update_marketing_campaign_status_backend(manager_a,campaign_a,'CANCELLED');
  if result->>'status' <> 'CANCELLED' then
    raise exception 'campaign could not be cancelled after all active partner assignments were closed';
  end if;

  perform set_config('request.jwt.claim.sub',customer_b::text,false);
  rejected:=false;
  begin
    perform public.create_marketing_campaign_backend(customer_b,business_b,'Customer Campaign','LEADS',array['META'],100,'customer-key-0001','EGP',null,null,'{}'::jsonb,null);
  exception when others then
    if sqlerrm='MARKETING_BUSINESS_SCOPE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'non-management business member created a campaign'; end if;

  if has_table_privilege('authenticated','public.marketing_campaigns','INSERT') then raise exception 'authenticated role has direct campaign INSERT'; end if;
  if has_table_privilege('authenticated','public.marketing_campaign_participants','INSERT') then raise exception 'authenticated role has direct participant INSERT'; end if;
  if has_function_privilege('anon','public.create_marketing_campaign_backend(uuid,uuid,text,text,text[],numeric,text,character varying,timestamp with time zone,timestamp with time zone,jsonb,text)','EXECUTE') then raise exception 'anon can execute campaign creation'; end if;
  if not has_function_privilege('authenticated','public.create_marketing_campaign_backend(uuid,uuid,text,text,text[],numeric,text,character varying,timestamp with time zone,timestamp with time zone,jsonb,text)','EXECUTE') then raise exception 'authenticated cannot execute campaign RPC'; end if;
end;
$test$;
reset role;

-- RC454 regression: a previously inactive participant must not bypass the
-- aggregate allocation cap by changing status back to an active state.
do $rc454_status_guard$
declare
  v_campaign uuid;
  v_active uuid;
  v_inactive uuid;
  v_rejected boolean := false;
begin
  select id into v_campaign
  from public.marketing_campaigns
  where idempotency_key='campaign-b-key-0001';
  if not found then raise exception 'RC454 test campaign not found'; end if;

  insert into public.marketing_campaign_participants(
    tenant_id,business_id,campaign_id,provider_id,role,allocation_percent,agreed_value,status,invited_by
  ) values (
    'TENANT-B','30000000-0000-4000-8000-000000000002',v_campaign,
    '40000000-0000-4000-8000-000000000001','MEDIA_BUYING',40,100,'ACTIVE',
    '30000000-0000-4000-8000-000000000012'
  ) returning id into v_active;

  insert into public.marketing_campaign_participants(
    tenant_id,business_id,campaign_id,provider_id,role,allocation_percent,agreed_value,status,invited_by
  ) values (
    'TENANT-B','30000000-0000-4000-8000-000000000002',v_campaign,
    '40000000-0000-4000-8000-000000000002','ANALYTICS',70,100,'DECLINED',
    '30000000-0000-4000-8000-000000000012'
  ) returning id into v_inactive;

  begin
    update public.marketing_campaign_participants
    set status='INVITED'
    where id=v_inactive;
  exception when others then
    if sqlerrm='MARKETING_ALLOCATION_OVER_100' then
      v_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_rejected then
    raise exception 'RC454 allowed an inactive participant to reactivate beyond 100 percent allocation';
  end if;
  if (select status from public.marketing_campaign_participants where id=v_inactive) <> 'DECLINED' then
    raise exception 'RC454 failed update did not preserve the original participant status';
  end if;
end;
$rc454_status_guard$;

select 'RC453 campaign workflow + RC454 allocation status regression: PASS' as result;
