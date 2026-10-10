-- RC442: approval audit rows are written only by the authoritative approval transition.
-- Remove direct client writes so users cannot forge audit history independently of request state.
drop policy if exists approval_actions_member_insert on public.approval_actions;
revoke insert, update, delete on table public.approval_actions from public, anon, authenticated;

create or replace function private.review_business_approval_atomic(
  p_actor_user_id uuid,
  p_approval_request_id varchar,
  p_action varchar
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.approval_requests%rowtype;
  v_action text := upper(trim(p_action));
  v_now timestamptz := now();
  v_updated integer := 0;
begin
  if p_actor_user_id is null or p_approval_request_id is null then
    raise exception 'required';
  end if;
  if v_action not in ('APPROVE','REJECT') then
    raise exception 'invalid_action';
  end if;

  select * into r
  from public.approval_requests
  where id=p_approval_request_id
  for update;

  if not found then raise exception 'approval_not_found'; end if;
  if upper(r.status) <> 'PENDING' then raise exception 'approval_already_resolved'; end if;
  if upper(r.entity_type) <> 'BUSINESS' or upper(r.request_type) <> 'CREATE' or r.business_id is null then
    raise exception 'unsupported_approval';
  end if;

  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id
      and m.tenant_id=r.tenant_id
      and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN','SUPER_ADMIN')
  ) then
    raise exception 'forbidden';
  end if;

  if v_action='APPROVE' then
    if not exists (
      select 1 from public.businesses b
      where b.id=r.business_id and b.tenant_id=r.tenant_id
    ) then
      raise exception 'business_not_found';
    end if;

    if not exists (
      select 1 from public.user_memberships m
      where m.user_id=r.requested_by
        and m.tenant_id=r.tenant_id
        and m.business_id=r.business_id
        and m.status='ACTIVE'
    ) then
      insert into public.user_memberships(
        id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status
      ) values (
        'MEM-'||gen_random_uuid()::text,r.requested_by,r.tenant_id,r.organization_id,r.business_id,r.branch_id,
        'BUSINESS_OWNER','{}'::jsonb,'ACTIVE'
      );
    end if;

    update public.businesses
    set status='ACTIVE',updated_at=v_now
    where id=r.business_id and tenant_id=r.tenant_id;

    update public.approval_requests
    set status='APPROVED',updated_at=v_now,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'resolved_by',p_actor_user_id,'resolved_at',v_now,'decision','APPROVE'
      )
    where id=r.id and status='PENDING';
  else
    update public.approval_requests
    set status='REJECTED',updated_at=v_now,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'resolved_by',p_actor_user_id,'resolved_at',v_now,'decision','REJECT'
      )
    where id=r.id and status='PENDING';
  end if;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'approval_transition_failed';
  end if;

  -- The audit record is committed in the same transaction as the state transition.
  insert into public.approval_actions(id,approval_request_id,action,acted_by,comment,created_at)
  values ('APACT-'||gen_random_uuid()::text,r.id,v_action,p_actor_user_id,null,v_now);

  return jsonb_build_object(
    'success',true,
    'approvalRequestId',r.id,
    'status',case when v_action='APPROVE' then 'APPROVED' else 'REJECTED' end,
    'businessId',r.business_id,
    'activated',v_action='APPROVE'
  );
end;
$$;

revoke all on function private.review_business_approval_atomic(uuid,varchar,varchar) from public,anon,authenticated;
grant execute on function private.review_business_approval_atomic(uuid,varchar,varchar) to service_role;
