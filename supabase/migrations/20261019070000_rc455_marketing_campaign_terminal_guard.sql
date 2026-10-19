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

