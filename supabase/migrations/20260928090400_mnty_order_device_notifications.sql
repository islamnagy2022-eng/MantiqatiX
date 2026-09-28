create or replace function private.mnty_notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
  select
    'NTF-' || gen_random_uuid()::text,
    new.tenant_id,
    m.user_id,
    'ORDER',
    'طلب جديد',
    'وصل طلب جديد إلى نشاطك. رقم الطلب: ' || new.id,
    'ORDER',
    new.id
  from public.user_memberships m
  where m.business_id = new.business_id
    and m.status = 'ACTIVE'
    and upper(coalesce(m.role,'')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN','MANAGER')
    and m.user_id is not null;
  return new;
end;
$$;

create or replace function private.mnty_notify_order_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.old_status is null or new.old_status = new.new_status then return new; end if;
  if new.order_id is not null then
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    select 'NTF-' || gen_random_uuid()::text,o.tenant_id,o.customer_id,'ORDER_STATUS','تحديث حالة الطلب',
      'تم تحديث حالة طلبك إلى: ' || new.new_status,'ORDER',o.id::text
    from public.orders o where o.id=new.order_id and o.customer_id is not null;

    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    select 'NTF-' || gen_random_uuid()::text,o.tenant_id,m.user_id,'ORDER_STATUS','تحديث حالة طلب',
      'تم تحديث حالة الطلب رقم ' || o.id::text || ' إلى: ' || new.new_status,'ORDER',o.id::text
    from public.orders o join public.user_memberships m on m.business_id=o.business_id
    where o.id=new.order_id and m.status='ACTIVE'
      and upper(coalesce(m.role,'')) in ('SERVICE_PROVIDER','BUSINESS_OWNER','OWNER','ADMIN','MANAGER')
      and m.user_id is not null and m.user_id<>o.customer_id;
  end if;
  return new;
end;
$$;

revoke all on function private.mnty_notify_order_created() from public,anon,authenticated;
revoke all on function private.mnty_notify_order_status_changed() from public,anon,authenticated;

drop trigger if exists mnty_order_created_notifications on public.orders;
create trigger mnty_order_created_notifications after insert on public.orders
for each row execute function private.mnty_notify_order_created();

drop trigger if exists mnty_order_status_notifications on public.order_status_history;
create trigger mnty_order_status_notifications after insert on public.order_status_history
for each row execute function private.mnty_notify_order_status_changed();