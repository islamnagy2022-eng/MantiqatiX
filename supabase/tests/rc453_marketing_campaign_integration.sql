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
select 'RC453 marketing campaign and partner workflow integration: PASS' as result;
