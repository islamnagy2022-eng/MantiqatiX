-- RC455: prevent terminal campaign states while partner assignments are still active.
-- Keep the existing authorization, transition, audit and idempotency contract intact.
create or replace function public.update_marketing_campaign_status_backend(
  p_actor uuid,
  p_campaign_id uuid,
  p_status character varying
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_status character varying;
  v_old_status character varying;
  v_allowed boolean := false;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'AUTH_REQUIRED'; end if;
  if p_actor is distinct from auth.uid() then raise exception 'ACTOR_MISMATCH'; end if;
  v_status := pg_catalog.upper(pg_catalog.btrim(coalesce(p_status,'')));
  if v_status not in ('DRAFT','PLANNED','IN_REVIEW','APPROVED','PAUSED','COMPLETED','CANCELLED') then raise exception 'MARKETING_STATUS_INVALID'; end if;

  select * into v_campaign from public.marketing_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'MARKETING_CAMPAIGN_NOT_FOUND'; end if;
  if not public.mnty_can_manage_marketing_business(v_campaign.business_id) then raise exception 'MARKETING_BUSINESS_SCOPE_REQUIRED'; end if;
  if v_campaign.status=v_status then return pg_catalog.jsonb_build_object('campaign_id',v_campaign.id,'status',v_status,'idempotent',true); end if;
  v_old_status := v_campaign.status;

  v_allowed := case v_campaign.status
    when 'DRAFT' then v_status in ('PLANNED','IN_REVIEW','CANCELLED')
    when 'PLANNED' then v_status in ('IN_REVIEW','PAUSED','CANCELLED')
    when 'IN_REVIEW' then v_status in ('APPROVED','DRAFT','CANCELLED')
    when 'APPROVED' then v_status in ('PAUSED','COMPLETED','CANCELLED')
    when 'PAUSED' then v_status in ('APPROVED','CANCELLED')
    else false
  end;
  if not v_allowed then raise exception 'MARKETING_STATUS_TRANSITION_INVALID'; end if;
  if v_status='PLANNED' and (v_campaign.budget<=0 or v_campaign.start_at is null or v_campaign.end_at is null) then raise exception 'MARKETING_PLAN_REQUIRES_BUDGET_AND_DATES'; end if;
  if v_status='IN_REVIEW' and (v_campaign.budget<=0 or pg_catalog.cardinality(v_campaign.channels)<1) then raise exception 'MARKETING_REVIEW_REQUIRES_BUDGET_AND_CHANNELS'; end if;
  if v_status='APPROVED' and exists(select 1 from public.marketing_campaign_participants cp where cp.campaign_id=v_campaign.id and cp.status='INVITED') then raise exception 'MARKETING_PARTNER_INVITATIONS_PENDING'; end if;
  if v_status in ('COMPLETED','CANCELLED') and exists(select 1 from public.marketing_campaign_participants cp where cp.campaign_id=v_campaign.id and cp.status in ('INVITED','ACCEPTED','ACTIVE')) then raise exception 'MARKETING_PARTICIPANTS_MUST_BE_CLOSED'; end if;

  update public.marketing_campaigns set status=v_status,updated_at=pg_catalog.now() where id=v_campaign.id returning * into v_campaign;
  insert into public.audit_logs(id,tenant_id,organization_id,business_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  select 'MCA-'||pg_catalog.gen_random_uuid()::text,v_campaign.tenant_id,b.organization_id,v_campaign.business_id,auth.uid(),
         'MARKETING_CAMPAIGN_STATUS_CHANGED','MARKETING_CAMPAIGN',v_campaign.id::text,
         pg_catalog.jsonb_build_object('status',v_old_status),
         pg_catalog.jsonb_build_object('status',v_status),'SUCCESS'
  from public.businesses b where b.id=v_campaign.business_id;

  return pg_catalog.jsonb_build_object('campaign_id',v_campaign.id,'status',v_campaign.status,'idempotent',false);
end;
$function$;



-- Serialize invitation responses against campaign status transitions using the same lock order.
create or replace function public.respond_marketing_campaign_invitation_backend(
  p_actor uuid,
  p_participant_id uuid,
  p_decision character varying
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_participant public.marketing_campaign_participants%rowtype;
  v_provider public.marketing_provider_profiles%rowtype;
  v_campaign public.marketing_campaigns%rowtype;
  v_decision character varying;
  v_campaign_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'AUTH_REQUIRED'; end if;
  if p_actor is distinct from auth.uid() then raise exception 'ACTOR_MISMATCH'; end if;
  v_decision := pg_catalog.upper(pg_catalog.btrim(coalesce(p_decision,'')));
  if v_decision not in ('ACCEPTED','DECLINED') then raise exception 'MARKETING_INVITATION_DECISION_INVALID'; end if;

  -- Lock campaign first to preserve a consistent campaign -> participant lock order
  -- with invitation creation and terminal-status transitions.
  select cp.campaign_id into v_campaign_id
  from public.marketing_campaign_participants cp
  where cp.id=p_participant_id;
  if not found then raise exception 'MARKETING_INVITATION_NOT_FOUND'; end if;

  select * into v_campaign
  from public.marketing_campaigns c
  where c.id=v_campaign_id
  for update;
  if not found then raise exception 'MARKETING_CAMPAIGN_NOT_FOUND'; end if;
  if v_campaign.status in ('COMPLETED','CANCELLED') then raise exception 'MARKETING_CAMPAIGN_LOCKED'; end if;

  select * into v_participant
  from public.marketing_campaign_participants cp
  where cp.id=p_participant_id and cp.campaign_id=v_campaign_id
  for update;
  if not found then raise exception 'MARKETING_INVITATION_NOT_FOUND'; end if;

  select * into v_provider from public.marketing_provider_profiles
  where id=v_participant.provider_id and owner_user_id=auth.uid() and status='ACTIVE' and is_verified is true;
  if not found then raise exception 'MARKETING_INVITATION_OWNER_REQUIRED'; end if;

  if v_participant.status <> 'INVITED' then
    if v_participant.status=v_decision then
      return pg_catalog.jsonb_build_object('participant_id',v_participant.id,'status',v_participant.status,'idempotent',true);
    end if;
    raise exception 'MARKETING_INVITATION_NOT_PENDING';
  end if;

  update public.marketing_campaign_participants
  set status=v_decision,responded_at=pg_catalog.now(),updated_at=pg_catalog.now()
  where id=v_participant.id
  returning * into v_participant;

  select * into v_campaign from public.marketing_campaigns where id=v_participant.campaign_id;
  insert into public.audit_logs(id,tenant_id,organization_id,business_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  select 'MCA-'||pg_catalog.gen_random_uuid()::text,v_campaign.tenant_id,b.organization_id,v_campaign.business_id,auth.uid(),
         'MARKETING_PARTNER_INVITATION_RESPONDED','MARKETING_CAMPAIGN_PARTICIPANT',v_participant.id::text,
         pg_catalog.jsonb_build_object('status','INVITED'),
         pg_catalog.jsonb_build_object('status',v_decision,'campaign_id',v_campaign.id,'provider_id',v_participant.provider_id),
         'SUCCESS'
  from public.businesses b where b.id=v_campaign.business_id;

  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
  values ('MCN-'||pg_catalog.gen_random_uuid()::text,v_campaign.tenant_id,v_campaign.created_by,'MARKETING_CAMPAIGN_PARTNER_RESPONSE',
          'تحديث دعوة شراكة','تم الرد على دعوة المشروع «'||v_campaign.title||'»: '||v_decision,'MARKETING_CAMPAIGN',v_campaign.id::text);

  return pg_catalog.jsonb_build_object('participant_id',v_participant.id,'status',v_decision,'idempotent',false);
end;
$function$;

