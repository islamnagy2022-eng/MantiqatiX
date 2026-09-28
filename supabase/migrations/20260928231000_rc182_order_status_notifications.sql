-- RC182: order status notifications using existing notifications contract
create or replace function private.mnty_notify_order_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||gen_random_uuid()::text,new.tenant_id,new.customer_id,'ORDER_STATUS','تحديث حالة الطلب','تم تحديث حالة طلبك إلى: '||new.status||' — رقم الطلب: '||new.id,'ORDER',new.id);
    if upper(new.status)='CANCELLED' then
      insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
      select 'NTF-'||gen_random_uuid()::text,new.tenant_id,m.user_id,'ORDER_STATUS','إلغاء طلب','تم إلغاء الطلب رقم: '||new.id,'ORDER',new.id
      from public.user_memberships m where m.business_id=new.business_id and m.status='ACTIVE' and upper(coalesce(m.role,'')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN','MANAGER') and m.user_id is not null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists mnty_order_status_notifications on public.orders;
create trigger mnty_order_status_notifications after update of status on public.orders for each row execute function private.mnty_notify_order_status();