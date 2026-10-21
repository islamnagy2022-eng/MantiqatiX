-- RC529: branch-scope order status mutations and direct UPDATE access.
-- The UI is not an authorization boundary; constrain both the canonical RPC and RLS.
drop policy if exists orders_member_update_branch_guard on public.orders;
create policy orders_member_update_branch_guard
on public.orders
as restrictive
for update
to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1
    from public.user_memberships m
    where m.user_id=(select auth.uid())
      and coalesce(m.status,'ACTIVE')='ACTIVE'
      and m.tenant_id=orders.tenant_id
      and m.business_id=orders.business_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','STAFF','EMPLOYEE','CASHIER','DRIVER','SERVICE_PROVIDER')
      and (
        m.branch_id=orders.branch_id
        or (m.branch_id is null and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER'))
      )
  )
)
with check (
  coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  and exists (
    select 1
    from public.user_memberships m
    where m.user_id=(select auth.uid())
      and coalesce(m.status,'ACTIVE')='ACTIVE'
      and m.tenant_id=orders.tenant_id
      and m.business_id=orders.business_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','STAFF','EMPLOYEE','CASHIER','DRIVER','SERVICE_PROVIDER')
      and (
        m.branch_id=orders.branch_id
        or (m.branch_id is null and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER'))
      )
  )
);

create or replace function public.update_order_status_backend(
  p_order_id uuid,
  p_tenant_id character varying,
  p_user_id uuid,
  p_new_status character varying,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_order public.orders;
  v_role varchar;
  v_membership_business uuid;
  v_membership_branch varchar;
  v_is_staff boolean := false;
  v_scope_ok boolean := false;
  v_allowed boolean := false;
  v_payment_status text;
begin
  if p_user_id is null then
    raise exception 'AUTH_MISMATCH';
  end if;
  -- Only the JWT-verified Edge Function may invoke this backend-only RPC.
  -- Direct authenticated clients must not receive EXECUTE on this SECURITY DEFINER function.
  if coalesce(auth.role(),'') <> 'service_role'
     and (auth.uid() is null or p_user_id is distinct from auth.uid()) then
    raise exception 'AUTH_MISMATCH';
  end if;

  select * into v_order
  from public.orders
  where id=p_order_id and tenant_id=p_tenant_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  -- A customer may cancel only their own unpaid order; staff must have an
  -- active membership in the exact business and branch (or an explicitly
  -- business-wide OWNER/ADMIN/BUSINESS_OWNER membership with branch_id NULL).
  if v_order.customer_id=p_user_id and upper(p_new_status)='CANCELLED' then
    v_allowed := true;
  else
    select upper(m.role),m.business_id,m.branch_id
      into v_role,v_membership_business,v_membership_branch
    from public.user_memberships m
    where m.user_id=p_user_id
      and m.tenant_id=p_tenant_id
      and m.business_id=v_order.business_id
      and coalesce(m.status,'ACTIVE')='ACTIVE'
      and (
        m.branch_id=v_order.branch_id
        or (m.branch_id is null and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER'))
      )
    order by case when m.branch_id=v_order.branch_id then 0 else 1 end
    limit 1;

    v_is_staff := v_role=any(array[
      'OWNER','ADMIN','MANAGER','STAFF','EMPLOYEE','CASHIER','DRIVER','BUSINESS_OWNER','SERVICE_PROVIDER'
    ]);
    v_scope_ok := v_membership_business=v_order.business_id
      and (
        v_membership_branch=v_order.branch_id
        or (v_membership_branch is null and v_role in ('OWNER','ADMIN','BUSINESS_OWNER'))
      );

    if v_is_staff and v_scope_ok then
      v_allowed := case
        when v_order.status in ('PENDING','CREATED') and upper(p_new_status) in ('CONFIRMED','CANCELLED') then true
        when v_order.status='CONFIRMED' and upper(p_new_status) in ('PREPARING','CANCELLED') then true
        when v_order.status='PREPARING' and upper(p_new_status) in ('OUT_FOR_DELIVERY','CANCELLED') then true
        when v_order.status='OUT_FOR_DELIVERY' and upper(p_new_status)='DELIVERED' then true
        else false
      end;
    end if;
  end if;

  if not v_allowed then raise exception 'INVALID_ORDER_TRANSITION_OR_SCOPE'; end if;

  if upper(p_new_status)='CANCELLED' then
    select pi.status into v_payment_status
    from public.payment_intents pi
    where pi.order_id=v_order.id and pi.status not in ('CANCELLED','FAILED')
    order by pi.created_at desc
    limit 1;
    if v_payment_status='SUCCEEDED' then
      raise exception 'ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION';
    end if;
  end if;

  update public.orders
  set status=upper(p_new_status),notes=coalesce(p_reason,notes),updated_at=now()
  where id=p_order_id and tenant_id=p_tenant_id
    and business_id=v_order.business_id and branch_id is not distinct from v_order.branch_id;

  if not found then raise exception 'ORDER_SCOPE_CHANGED'; end if;
  return jsonb_build_object('id',p_order_id,'status',upper(p_new_status));
end;
$function$;

revoke all on function public.update_order_status_backend(uuid,character varying,uuid,character varying,text) from public, anon, authenticated, service_role;
grant execute on function public.update_order_status_backend(uuid,character varying,uuid,character varying,text) to service_role;
