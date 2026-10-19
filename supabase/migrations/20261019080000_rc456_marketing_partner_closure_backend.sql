-- RC456: provide an audited manager-side closure path for marketing partner assignments.
-- This is source-only until the migration is applied and verified in the target database.
-- Lock order is campaign -> participant, matching RC453/RC455 invitation/status operations.
create or replace function public.close_marketing_campaign_partner_backend(
  p_actor uuid,
  p_participant_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign_id uuid;
  v_campaign public.marketing_campaigns%rowtype;
  v_participant public.marketing_campaign_participants%rowtype;
  v_provider public.marketing_provider_profiles%rowtype;
  v_reason text;
  v_old_status character varying;
  v_organization_id character varying;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_actor is distinct from auth.uid() then
    raise exception 'ACTOR_MISMATCH';
  end if;

  v_reason := nullif(pg_catalog.btrim(coalesce(p_reason,'')), '');
  if v_reason is not null and pg_catalog.length(v_reason) > 500 then
    raise exception 'MARKETING_PARTNER_CLOSURE_REASON_TOO_LONG';
  end if;

  -- First read only the foreign key, then acquire locks in canonical order.
  select cp.campaign_id into v_campaign_id
  from public.marketing_campaign_participants cp
  where cp.id = p_participant_id;
  if not found then
    raise exception 'MARKETING_PARTICIPANT_NOT_FOUND';
  end if;

  select * into v_campaign
  from public.marketing_campaigns c
  where c.id = v_campaign_id
  for update;
  if not found then
    raise exception 'MARKETING_CAMPAIGN_NOT_FOUND';
  end if;
  if not public.mnty_can_manage_marketing_business(v_campaign.business_id) then
    raise exception 'MARKETING_BUSINESS_SCOPE_REQUIRED';
  end if;
  if v_campaign.status in ('COMPLETED','CANCELLED') then
    raise exception 'MARKETING_CAMPAIGN_LOCKED';
  end if;

  select * into v_participant
  from public.marketing_campaign_participants cp
  where cp.id = p_participant_id
    and cp.campaign_id = v_campaign.id
  for update;
  if not found then
    raise exception 'MARKETING_PARTICIPANT_NOT_FOUND';
  end if;

  if v_participant.business_id is distinct from v_campaign.business_id
     or v_participant.tenant_id is distinct from v_campaign.tenant_id then
    raise exception 'MARKETING_PARTICIPANT_SCOPE_MISMATCH';
  end if;

  if v_participant.status = 'REMOVED' then
    return pg_catalog.jsonb_build_object(
      'participant_id', v_participant.id,
      'status', 'REMOVED',
      'idempotent', true
    );
  end if;
  if v_participant.status not in ('INVITED','ACCEPTED','ACTIVE') then
    raise exception 'MARKETING_PARTICIPANT_NOT_CLOSABLE';
  end if;

  v_old_status := v_participant.status;
  select p.* into v_provider
  from public.marketing_provider_profiles p
  where p.id = v_participant.provider_id;

  update public.marketing_campaign_participants
  set status = 'REMOVED',
      updated_at = pg_catalog.now()
  where id = v_participant.id
  returning * into v_participant;

  select b.organization_id into v_organization_id
  from public.businesses b
  where b.id = v_campaign.business_id;

  insert into public.audit_logs(
    id,tenant_id,organization_id,business_id,actor_user_id,action,
    entity_type,entity_id,old_values,new_values,result
  ) values (
    'MCA-'||pg_catalog.gen_random_uuid()::text,
    v_campaign.tenant_id,v_organization_id,v_campaign.business_id,auth.uid(),
    'MARKETING_PARTNER_ASSIGNMENT_CLOSED',
    'MARKETING_CAMPAIGN_PARTICIPANT',v_participant.id::text,
    pg_catalog.jsonb_build_object(
      'status',v_old_status,
      'campaign_id',v_campaign.id,
      'provider_id',v_participant.provider_id
    ),
    pg_catalog.jsonb_build_object(
      'status','REMOVED',
      'campaign_id',v_campaign.id,
      'provider_id',v_participant.provider_id,
      'reason',v_reason
    ),
    'SUCCESS'
  );

  if v_provider.owner_user_id is not null then
    insert into public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id
    ) values (
      'MCN-'||pg_catalog.gen_random_uuid()::text,
      v_campaign.tenant_id,
      v_provider.owner_user_id,
      'MARKETING_PARTNER_ASSIGNMENT_CLOSED',
      'إنهاء المشاركة في الحملة',
      'تم إنهاء مشاركتك في الحملة «'||v_campaign.title||'».'
        || case when v_reason is not null then ' السبب: '||v_reason else '' end,
      'MARKETING_CAMPAIGN',
      v_campaign.id::text
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'participant_id',v_participant.id,
    'status','REMOVED',
    'idempotent',false
  );
end;
$function$;

revoke all on function public.close_marketing_campaign_partner_backend(uuid,uuid,text)
  from public, anon;
grant execute on function public.close_marketing_campaign_partner_backend(uuid,uuid,text)
  to authenticated;
