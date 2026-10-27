-- RC457: server-authoritative marketing lead lifecycle transitions.
-- Forward-only source migration. Do not apply to production until the release owner authorizes it.
-- Customer lead creation remains separate; only scoped internal staff may transition business-bound leads.

create unique index if not exists audit_logs_marketing_lead_lifecycle_request_uq
  on public.audit_logs (entity_id, (new_values ->> 'request_id'))
  where entity_type = 'MARKETING_LEAD'
    and action = 'MARKETING_LEAD_STATUS_CHANGED'
    and new_values ? 'request_id';

create or replace function public.transition_marketing_lead_backend(
  p_actor uuid,
  p_lead_id uuid,
  p_expected_status text,
  p_new_status text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_lead public.marketing_leads%rowtype;
  v_current_status text;
  v_expected_status text;
  v_new_status text;
  v_tenant_id text;
  v_organization_id text;
  v_existing_actor uuid;
  v_existing_old jsonb;
  v_existing_new jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_actor is distinct from auth.uid() then
    raise exception 'ACTOR_MISMATCH';
  end if;
  if p_request_id is null then
    raise exception 'LEAD_REQUEST_ID_REQUIRED';
  end if;

  v_expected_status := pg_catalog.upper(pg_catalog.btrim(coalesce(p_expected_status, '')));
  v_new_status := pg_catalog.upper(pg_catalog.btrim(coalesce(p_new_status, '')));
  if v_new_status not in (
    'CONTACT_ATTEMPTED','CONTACTED','QUALIFIED','PROPOSAL','CONVERTED',
    'NOT_QUALIFIED','FOLLOW_UP_SCHEDULED','RETAINED','CLOSED'
  ) then
    raise exception 'LEAD_STATUS_INVALID';
  end if;

  select * into v_lead
  from public.marketing_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'LEAD_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if v_lead.requester_business_id is null
     or not public.mnty_can_manage_marketing_business(v_lead.requester_business_id) then
    raise exception 'LEAD_NOT_FOUND_OR_FORBIDDEN';
  end if;

  select b.tenant_id, b.organization_id
    into v_tenant_id, v_organization_id
  from public.businesses b
  where b.id = v_lead.requester_business_id
    and b.status = 'ACTIVE';

  if v_tenant_id is null then
    raise exception 'LEAD_NOT_FOUND_OR_FORBIDDEN';
  end if;

  -- A repeated request returns the original result only for the same actor and exact transition.
  select a.actor_user_id, a.old_values, a.new_values
    into v_existing_actor, v_existing_old, v_existing_new
  from public.audit_logs a
  where a.entity_type = 'MARKETING_LEAD'
    and a.action = 'MARKETING_LEAD_STATUS_CHANGED'
    and a.entity_id = v_lead.id::text
    and a.new_values ->> 'request_id' = p_request_id::text
  limit 1;

  if found then
    if v_existing_actor = auth.uid()
       and v_existing_old ->> 'status' = v_expected_status
       and v_existing_new ->> 'status' = v_new_status then
      return pg_catalog.jsonb_build_object(
        'lead_id', v_lead.id,
        'status', v_new_status,
        'idempotent', true
      );
    end if;
    raise exception 'LEAD_IDEMPOTENCY_KEY_CONFLICT';
  end if;

  v_current_status := pg_catalog.upper(pg_catalog.btrim(coalesce(v_lead.status, '')));
  if v_current_status is distinct from v_expected_status then
    raise exception 'LEAD_STATUS_CONFLICT';
  end if;

  -- NEW is explicitly accepted as a known legacy value from existing disposable fixtures.
  -- It is not silently rewritten; the caller must provide NEW as the expected current status.
  if not (
    (v_current_status in ('OPEN','NEW') and v_new_status = 'CONTACT_ATTEMPTED')
    or (v_current_status = 'CONTACT_ATTEMPTED' and v_new_status in ('CONTACTED','FOLLOW_UP_SCHEDULED','NOT_QUALIFIED'))
    or (v_current_status = 'CONTACTED' and v_new_status in ('QUALIFIED','FOLLOW_UP_SCHEDULED','NOT_QUALIFIED'))
    or (v_current_status = 'FOLLOW_UP_SCHEDULED' and v_new_status in ('CONTACT_ATTEMPTED','CONTACTED','QUALIFIED','NOT_QUALIFIED','CLOSED'))
    or (v_current_status = 'QUALIFIED' and v_new_status in ('PROPOSAL','FOLLOW_UP_SCHEDULED','NOT_QUALIFIED'))
    or (v_current_status = 'PROPOSAL' and v_new_status in ('CONVERTED','FOLLOW_UP_SCHEDULED','NOT_QUALIFIED'))
    or (v_current_status = 'CONVERTED' and v_new_status in ('RETAINED','CLOSED'))
    or (v_current_status = 'RETAINED' and v_new_status in ('FOLLOW_UP_SCHEDULED','CLOSED'))
    or (v_current_status = 'NOT_QUALIFIED' and v_new_status in ('FOLLOW_UP_SCHEDULED','CLOSED'))
  ) then
    raise exception 'LEAD_TRANSITION_NOT_ALLOWED';
  end if;

  update public.marketing_leads
  set status = v_new_status
  where id = v_lead.id;

  -- audit_logs is the canonical audit store. Status transitions contain no free-text notes/PII.
  insert into public.audit_logs(
    id, tenant_id, organization_id, business_id, actor_user_id,
    action, entity_type, entity_id, old_values, new_values, result
  ) values (
    'MLC-' || pg_catalog.gen_random_uuid()::text,
    v_tenant_id, v_organization_id, v_lead.requester_business_id, auth.uid(),
    'MARKETING_LEAD_STATUS_CHANGED', 'MARKETING_LEAD', v_lead.id::text,
    pg_catalog.jsonb_build_object('status', v_current_status),
    pg_catalog.jsonb_build_object('status', v_new_status, 'request_id', p_request_id::text),
    'SUCCESS'
  );

  return pg_catalog.jsonb_build_object(
    'lead_id', v_lead.id,
    'status', v_new_status,
    'idempotent', false
  );
end;
$function$;

revoke all on function public.transition_marketing_lead_backend(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.transition_marketing_lead_backend(uuid, uuid, text, text, uuid) to authenticated;
