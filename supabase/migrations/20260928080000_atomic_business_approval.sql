-- Make business approval atomic: membership activation, business activation,
-- and approval status transition succeed or fail together.
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
  r approval_requests%rowtype;
  v_action text := upper(trim(p_action));
  v_now timestamptz := now();
begin
  if p_actor_user_id is null or p_approval_request_id is null then raise exception 'required'; end if;
  if v_action not in ('APPROVE','REJECT') then raise exception 'invalid_action'; end if;
  select * into r from approval_requests where id=p_approval_request_id for update;
  if not found then raise exception 'approval_not_found'; end if;
  if upper(r.status) <> 'PENDING' then raise exception 'approval_already_resolved'; end if;
  if upper(r.entity_type) <> 'BUSINESS' or upper(r.request_type) <> 'CREATE' or r.business_id is null then raise exception 'unsupported_approval'; end if;
  if not exists (
    select 1 from user_memberships m where m.user_id=p_actor_user_id and m.tenant_id=r.tenant_id
      and m.status='ACTIVE' and upper(m.role) in ('OWNER','ADMIN','SUPER_ADMIN')
  ) then raise exception 'forbidden'; end if;

  if v_action='APPROVE' then
    if not exists (select 1 from businesses b where b.id=r.business_id and b.tenant_id=r.tenant_id)
      then raise exception 'business_not_found'; end if;
    if not exists (
      select 1 from user_memberships m where m.user_id=r.requested_by and m.tenant_id=r.tenant_id
        and m.business_id=r.business_id and m.status='ACTIVE'
    ) then
      insert into user_memberships(
        id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status
      ) values (
        'MEM-'||gen_random_uuid()::text,r.requested_by,r.tenant_id,r.organization_id,r.business_id,r.branch_id,
        'BUSINESS_OWNER','{}'::jsonb,'ACTIVE'
      );
    end if;
    update businesses set status='ACTIVE',updated_at=v_now where id=r.business_id and tenant_id=r.tenant_id;
    update approval_requests set status='APPROVED',updated_at=v_now,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('resolved_by',p_actor_user_id,'resolved_at',v_now,'decision','APPROVE')
      where id=r.id and status='PENDING';
  else
    update approval_requests set status='REJECTED',updated_at=v_now,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('resolved_by',p_actor_user_id,'resolved_at',v_now,'decision','REJECT')
      where id=r.id and status='PENDING';
  end if;

  return jsonb_build_object('success',true,'approvalRequestId',r.id,
    'status',case when v_action='APPROVE' then 'APPROVED' else 'REJECTED' end,
    'businessId',r.business_id,'activated',v_action='APPROVE');
end;
$$;
revoke all on function private.review_business_approval_atomic(uuid,varchar,varchar) from public,anon,authenticated;
grant execute on function private.review_business_approval_atomic(uuid,varchar,varchar) to service_role;
