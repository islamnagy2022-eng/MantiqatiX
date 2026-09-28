-- RC181: customer can cancel own cross-tenant marketplace order without provider-tenant membership
create or replace function public.update_order_status_backend(p_order_id uuid,p_tenant_id varchar,p_user_id uuid,p_new_status varchar,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_role varchar; v_membership_business uuid; v_is_staff boolean:=false; v_scope_ok boolean:=false; v_allowed boolean:=false; v_payment_status text;
begin
 if p_user_id is null or auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'AUTH_MISMATCH'; end if;
 select * into v_order from public.orders where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_order.customer_id=p_user_id and upper(p_new_status)='CANCELLED' then v_allowed:=true; end if;
 if not v_allowed then
   select upper(m.role),m.business_id into v_role,v_membership_business from public.user_memberships m where m.user_id=p_user_id and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE' order by case when m.business_id=v_order.business_id then 0 else 1 end limit 1;
   v_is_staff:=v_role=any(array['OWNER','ADMIN','MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER','SERVICE_PROVIDER']);
   v_scope_ok:=v_role=any(array['OWNER','ADMIN']) or (v_role in ('MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER','SERVICE_PROVIDER') and v_membership_business=v_order.business_id);
   if v_is_staff and v_scope_ok then
     v_allowed:=case when v_order.status in ('PENDING','CREATED') and upper(p_new_status) in ('CONFIRMED','CANCELLED') then true when v_order.status='CONFIRMED' and upper(p_new_status) in ('PREPARING','CANCELLED') then true when v_order.status='PREPARING' and upper(p_new_status) in ('OUT_FOR_DELIVERY','CANCELLED') then true when v_order.status='OUT_FOR_DELIVERY' and upper(p_new_status)='DELIVERED' then true else false end;
   end if;
 end if;
 if not v_allowed then raise exception 'INVALID_ORDER_TRANSITION'; end if;
 if upper(p_new_status)='CANCELLED' then
   select pi.status into v_payment_status from public.payment_intents pi where pi.order_id=v_order.id and pi.status not in ('CANCELLED','FAILED') order by pi.created_at desc limit 1;
   if v_payment_status='SUCCEEDED' then raise exception 'ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION'; end if;
 end if;
 update public.orders set status=upper(p_new_status),notes=coalesce(p_reason,notes),updated_at=now() where id=p_order_id;
 return jsonb_build_object('id',p_order_id,'status',upper(p_new_status));
end $$;