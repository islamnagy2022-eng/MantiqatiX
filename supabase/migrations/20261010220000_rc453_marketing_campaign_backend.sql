-- RC453: secure internal marketing campaign planning and partner collaboration.
-- This creates an internal workflow only. It does not publish ads to Meta/TikTok/Google.
create table public.marketing_campaigns (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  tenant_id character varying not null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  created_by uuid not null,
  title character varying(160) not null check (pg_catalog.length(pg_catalog.btrim(title)) between 3 and 160),
  objective character varying(32) not null check (objective in ('AWARENESS','TRAFFIC','LEADS','SALES','ENGAGEMENT','APP_INSTALLS')),
  channels text[] not null check (pg_catalog.cardinality(channels) between 1 and 8),
  budget numeric(14,2) not null check (budget >= 0),
  idempotency_key text not null check (pg_catalog.length(idempotency_key) between 8 and 100),
  currency character varying(3) not null check (currency ~ '^[A-Z]{3}$'),
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  target_audience jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(target_audience) = 'object'),
  brief text check (brief is null or pg_catalog.length(brief) <= 5000),
  status character varying(20) not null default 'DRAFT'
    check (status in ('DRAFT','PLANNED','IN_REVIEW','APPROVED','PAUSED','COMPLETED','CANCELLED')),
  created_at timestamp with time zone not null default pg_catalog.now(),
  updated_at timestamp with time zone not null default pg_catalog.now(),
  unique(business_id,idempotency_key),
  check (
    (start_at is null and end_at is null)
    or (start_at is not null and end_at is not null and start_at < end_at)
  )
);

create index marketing_campaigns_business_status_idx
  on public.marketing_campaigns(business_id,status,created_at desc);
create index marketing_campaigns_tenant_created_idx
  on public.marketing_campaigns(tenant_id,created_at desc);

create table public.marketing_campaign_participants (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  tenant_id character varying not null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  provider_id uuid not null references public.marketing_provider_profiles(id) on delete restrict,
  role character varying(24) not null
    check (role in ('CREATIVE','CONTENT','MEDIA_BUYING','ANALYTICS','ACCOUNT_MANAGER','REFERRAL')),
  allocation_percent numeric(5,2) not null default 0
    check (allocation_percent >= 0 and allocation_percent <= 100),
  agreed_value numeric(14,2) not null default 0 check (agreed_value >= 0),
  status character varying(16) not null default 'INVITED'
    check (status in ('INVITED','ACCEPTED','DECLINED','ACTIVE','COMPLETED','REMOVED')),
  invited_by uuid not null,
  responded_at timestamp with time zone,
  created_at timestamp with time zone not null default pg_catalog.now(),
  updated_at timestamp with time zone not null default pg_catalog.now(),
  unique(campaign_id,provider_id)
);

create index marketing_campaign_participants_provider_status_idx
  on public.marketing_campaign_participants(provider_id,status);
create index marketing_campaign_participants_business_campaign_idx
  on public.marketing_campaign_participants(business_id,campaign_id,status);

create or replace function public.mnty_can_manage_marketing_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_business_id is not null
    and exists (
      select 1
      from public.businesses b
      where b.id = p_business_id
        and b.status = 'ACTIVE'
        and (
          exists (
            select 1
            from public.user_memberships um
            where um.user_id = auth.uid()
              and um.status = 'ACTIVE'
              and um.tenant_id = b.tenant_id
              and pg_catalog.upper(coalesce(um.role,'')) in ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
              and (um.business_id = b.id or um.business_id is null)
          )
          or exists (
            select 1
            from public.user_memberships platform_admin
            where platform_admin.user_id = auth.uid()
              and platform_admin.status = 'ACTIVE'
              and pg_catalog.upper(platform_admin.role) = 'SUPER_ADMIN'
              and platform_admin.tenant_id = 'MNTY-PLATFORM'
              and platform_admin.permissions ->> 'scope' = 'PLATFORM'
              and platform_admin.permissions ->> 'full_control' = 'true'
          )
        )
    )
$function$;

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_participants enable row level security;
revoke all on table public.marketing_campaigns, public.marketing_campaign_participants from anon, authenticated;
grant select on table public.marketing_campaigns, public.marketing_campaign_participants to authenticated;

create policy marketing_campaigns_scoped_read
  on public.marketing_campaigns
  for select to authenticated
  using (
    public.mnty_can_manage_marketing_business(business_id)
    or exists (
      select 1
      from public.marketing_campaign_participants cp
      join public.marketing_provider_profiles p on p.id = cp.provider_id
      where cp.campaign_id = marketing_campaigns.id
        and p.owner_user_id = auth.uid()
        and cp.status in ('INVITED','ACCEPTED','ACTIVE')
    )
  );

create policy marketing_campaign_participants_scoped_read
  on public.marketing_campaign_participants
  for select to authenticated
  using (
    public.mnty_can_manage_marketing_business(business_id)
    or exists (
      select 1
      from public.marketing_provider_profiles p
      where p.id = marketing_campaign_participants.provider_id
        and p.owner_user_id = auth.uid()
    )
  );

create or replace function public.create_marketing_campaign_backend(
  p_actor uuid,
  p_business_id uuid,
  p_title text,
  p_objective text,
  p_channels text[],
  p_budget numeric,
  p_idempotency_key text,
  p_currency character varying default 'EGP',
  p_start_at timestamp with time zone default null,
  p_end_at timestamp with time zone default null,
  p_target_audience jsonb default '{}'::jsonb,
  p_brief text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_title text;
  v_objective text;
  v_channels text[];
  v_budget numeric;
  v_currency character varying;
  v_idempotency_key text;
  v_existing public.marketing_campaigns%rowtype;
  v_audience jsonb;
  v_tenant character varying;
  v_organization character varying;
  v_campaign_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_actor is distinct from auth.uid() then raise exception 'ACTOR_MISMATCH'; end if;
  if not public.mnty_can_manage_marketing_business(p_business_id) then raise exception 'MARKETING_BUSINESS_SCOPE_REQUIRED'; end if;

  v_title := pg_catalog.btrim(coalesce(p_title,''));
  if pg_catalog.length(v_title) < 3 or pg_catalog.length(v_title) > 160 then raise exception 'MARKETING_TITLE_INVALID'; end if;

  v_objective := pg_catalog.upper(pg_catalog.btrim(coalesce(p_objective,'')));
  if v_objective not in ('AWARENESS','TRAFFIC','LEADS','SALES','ENGAGEMENT','APP_INSTALLS') then raise exception 'MARKETING_OBJECTIVE_INVALID'; end if;

  select coalesce(pg_catalog.array_agg(distinct pg_catalog.upper(pg_catalog.btrim(ch)) order by pg_catalog.upper(pg_catalog.btrim(ch))),array[]::text[])
    into v_channels
  from pg_catalog.unnest(coalesce(p_channels,array[]::text[])) as u(ch)
  where pg_catalog.btrim(ch) <> '';
  if pg_catalog.cardinality(v_channels) < 1 or pg_catalog.cardinality(v_channels) > 8 then raise exception 'MARKETING_CHANNEL_COUNT_INVALID'; end if;
  if exists (
    select 1 from pg_catalog.unnest(v_channels) as u(ch)
    where ch not in ('META','TIKTOK','GOOGLE','YOUTUBE','LINKEDIN','SNAPCHAT','OTHER')
  ) then raise exception 'MARKETING_CHANNEL_INVALID'; end if;

  if p_budget is null or p_budget < 0 or p_budget > 1000000000 then raise exception 'MARKETING_BUDGET_INVALID'; end if;
  v_budget := round(p_budget,2);
  v_idempotency_key := pg_catalog.btrim(coalesce(p_idempotency_key,''));
  if pg_catalog.length(v_idempotency_key) < 8 or pg_catalog.length(v_idempotency_key) > 100 or pg_catalog.translate(v_idempotency_key,'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:_-','') <> '' then raise exception 'MARKETING_IDEMPOTENCY_KEY_INVALID'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'MARKETING_CURRENCY_INVALID'; end if;
  if (p_start_at is null) <> (p_end_at is null) or (p_start_at is not null and p_start_at >= p_end_at) then raise exception 'MARKETING_SCHEDULE_INVALID'; end if;
  v_audience := coalesce(p_target_audience,'{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_audience) <> 'object' or pg_catalog.octet_length(v_audience::text) > 4000 then raise exception 'MARKETING_AUDIENCE_INVALID'; end if;
  if p_brief is not null and pg_catalog.length(p_brief) > 5000 then raise exception 'MARKETING_BRIEF_TOO_LONG'; end if;

  select b.tenant_id,b.organization_id into v_tenant,v_organization
  from public.businesses b where b.id=p_business_id and b.status='ACTIVE';
  if v_tenant is null then raise exception 'MARKETING_BUSINESS_INACTIVE'; end if;

  insert into public.marketing_campaigns(
    tenant_id,business_id,created_by,title,objective,channels,budget,idempotency_key,currency,start_at,end_at,target_audience,brief,status
  ) values (
    v_tenant,p_business_id,auth.uid(),v_title,v_objective,v_channels,v_budget,v_idempotency_key,v_currency,p_start_at,p_end_at,v_audience,nullif(pg_catalog.btrim(coalesce(p_brief,'')),''),'DRAFT'
  ) on conflict (business_id,idempotency_key) do nothing returning id into v_campaign_id;
  if v_campaign_id is null then
    select * into v_existing from public.marketing_campaigns where business_id=p_business_id and idempotency_key=v_idempotency_key;
    return pg_catalog.jsonb_build_object('campaign_id',v_existing.id,'title',v_existing.title,'status',v_existing.status,'idempotent',true);
  end if;

  insert into public.audit_logs(id,tenant_id,organization_id,business_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values (
    'MCA-'||pg_catalog.gen_random_uuid()::text,v_tenant,v_organization,p_business_id,auth.uid(),
    'MARKETING_CAMPAIGN_CREATED','MARKETING_CAMPAIGN',v_campaign_id::text,'{}'::jsonb,
    pg_catalog.jsonb_build_object('title',v_title,'objective',v_objective,'channels',v_channels,'budget',v_budget,'currency',v_currency,'status','DRAFT'),
    'SUCCESS'
  );

  return pg_catalog.jsonb_build_object('campaign_id',v_campaign_id,'title',v_title,'status','DRAFT','idempotent',false);
end;
$function$;

create or replace function public.invite_marketing_campaign_partner_backend(
  p_actor uuid,
  p_campaign_id uuid,
  p_provider_id uuid,
  p_role character varying,
  p_allocation_percent numeric default 0,
  p_agreed_value numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign public.marketing_campaigns%rowtype;
  v_provider public.marketing_provider_profiles%rowtype;
  v_participant public.marketing_campaign_participants%rowtype;
  v_role character varying;
  v_allocation numeric;
  v_agreed numeric;
  v_allocated numeric;
  v_reinvite boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_actor is distinct from auth.uid() then raise exception 'ACTOR_MISMATCH'; end if;
  select * into v_campaign from public.marketing_campaigns where id=p_campaign_id for update;
  if not found then raise exception 'MARKETING_CAMPAIGN_NOT_FOUND'; end if;
  if not public.mnty_can_manage_marketing_business(v_campaign.business_id) then raise exception 'MARKETING_BUSINESS_SCOPE_REQUIRED'; end if;
  if v_campaign.status not in ('DRAFT','PLANNED','IN_REVIEW') then raise exception 'MARKETING_CAMPAIGN_LOCKED'; end if;

  select * into v_provider
  from public.marketing_provider_profiles p
  where p.id=p_provider_id
    and p.status='ACTIVE'
    and p.is_verified is true
    and p.provider_kind in ('PARTNER_COMPANY','FREELANCER')
    and p.owner_user_id is not null
    and (p.business_id is null or p.business_id <> v_campaign.business_id)
  for share;
  if not found then raise exception 'MARKETING_PARTNER_NOT_ELIGIBLE'; end if;

  v_role := pg_catalog.upper(pg_catalog.btrim(coalesce(p_role,'')));
  if v_role not in ('CREATIVE','CONTENT','MEDIA_BUYING','ANALYTICS','ACCOUNT_MANAGER','REFERRAL') then raise exception 'MARKETING_PARTNER_ROLE_INVALID'; end if;
  v_allocation := coalesce(p_allocation_percent,0);
  v_agreed := coalesce(p_agreed_value,0);
  if v_allocation < 0 or v_allocation > 100 then raise exception 'MARKETING_ALLOCATION_INVALID'; end if;
  if v_agreed < 0 or v_agreed > 1000000000 then raise exception 'MARKETING_PARTNER_VALUE_INVALID'; end if;

  select coalesce(sum(cp.allocation_percent),0) into v_allocated
  from public.marketing_campaign_participants cp
  where cp.campaign_id=p_campaign_id
    and cp.provider_id <> p_provider_id
    and cp.status in ('INVITED','ACCEPTED','ACTIVE');
  if v_allocated + v_allocation > 100 then raise exception 'MARKETING_ALLOCATION_OVER_100'; end if;

  select * into v_participant
  from public.marketing_campaign_participants
  where campaign_id=p_campaign_id and provider_id=p_provider_id
  for update;

  if found and v_participant.status not in ('DECLINED','REMOVED') then
    if v_participant.role=v_role and v_participant.allocation_percent=v_allocation and v_participant.agreed_value=v_agreed then
      return pg_catalog.jsonb_build_object('participant_id',v_participant.id,'status',v_participant.status,'idempotent',true);
    end if;
    raise exception 'MARKETING_PARTNER_ALREADY_ASSIGNED';
  end if;

  if found then
    v_reinvite := true;
    update public.marketing_campaign_participants
      set role=v_role,allocation_percent=v_allocation,agreed_value=v_agreed,status='INVITED',
          invited_by=auth.uid(),responded_at=null,updated_at=pg_catalog.now()
      where id=v_participant.id
      returning * into v_participant;
  else
    insert into public.marketing_campaign_participants(
      tenant_id,business_id,campaign_id,provider_id,role,allocation_percent,agreed_value,status,invited_by
    ) values (
      v_campaign.tenant_id,v_campaign.business_id,v_campaign.id,p_provider_id,v_role,v_allocation,v_agreed,'INVITED',auth.uid()
    ) returning * into v_participant;
  end if;

  insert into public.audit_logs(id,tenant_id,organization_id,business_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  select 'MCA-'||pg_catalog.gen_random_uuid()::text,v_campaign.tenant_id,b.organization_id,v_campaign.business_id,auth.uid(),
         case when v_reinvite then 'MARKETING_PARTNER_REINVITED' else 'MARKETING_PARTNER_INVITED' end,
         'MARKETING_CAMPAIGN_PARTICIPANT',v_participant.id::text,'{}'::jsonb,
         pg_catalog.jsonb_build_object('campaign_id',v_campaign.id,'provider_id',p_provider_id,'role',v_role,'allocation_percent',v_allocation,'agreed_value',v_agreed,'status','INVITED'),
         'SUCCESS'
  from public.businesses b where b.id=v_campaign.business_id;

  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
  values ('MCN-'||pg_catalog.gen_random_uuid()::text,v_campaign.tenant_id,v_provider.owner_user_id,'MARKETING_CAMPAIGN_INVITATION',
          'دعوة تعاون تسويقي','تمت دعوتك للمشاركة في المشروع: '||v_campaign.title,'MARKETING_CAMPAIGN',v_campaign.id::text);

  return pg_catalog.jsonb_build_object('participant_id',v_participant.id,'status','INVITED','idempotent',false);
end;
$function$;

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
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_actor is distinct from auth.uid() then raise exception 'ACTOR_MISMATCH'; end if;
  v_decision := pg_catalog.upper(pg_catalog.btrim(coalesce(p_decision,'')));
  if v_decision not in ('ACCEPTED','DECLINED') then raise exception 'MARKETING_INVITATION_DECISION_INVALID'; end if;

  select * into v_participant from public.marketing_campaign_participants where id=p_participant_id for update;
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
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
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

revoke all on function public.mnty_can_manage_marketing_business(uuid) from public, anon;
revoke all on function public.create_marketing_campaign_backend(uuid,uuid,text,text,text[],numeric,text,character varying,timestamp with time zone,timestamp with time zone,jsonb,text) from public, anon;
revoke all on function public.invite_marketing_campaign_partner_backend(uuid,uuid,uuid,character varying,numeric,numeric) from public, anon;
revoke all on function public.respond_marketing_campaign_invitation_backend(uuid,uuid,character varying) from public, anon;
revoke all on function public.update_marketing_campaign_status_backend(uuid,uuid,character varying) from public, anon;
grant execute on function public.mnty_can_manage_marketing_business(uuid) to authenticated;
grant execute on function public.create_marketing_campaign_backend(uuid,uuid,text,text,text[],numeric,text,character varying,timestamp with time zone,timestamp with time zone,jsonb,text) to authenticated;
grant execute on function public.invite_marketing_campaign_partner_backend(uuid,uuid,uuid,character varying,numeric,numeric) to authenticated;
grant execute on function public.respond_marketing_campaign_invitation_backend(uuid,uuid,character varying) to authenticated;
grant execute on function public.update_marketing_campaign_status_backend(uuid,uuid,character varying) to authenticated;
