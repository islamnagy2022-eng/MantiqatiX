-- RC109: harden tenant boundaries for orders and support records.
drop policy if exists orders_member_select on public.orders;
create policy orders_member_select
on public.orders for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id::text = orders.tenant_id::text
      and m.status = 'ACTIVE'
  )
  and (
    customer_id = auth.uid()
    or exists (
      select 1 from public.user_memberships m2
      where m2.user_id = auth.uid()
        and m2.tenant_id::text = orders.tenant_id::text
        and m2.status = 'ACTIVE'
        and m2.role = any(array['OWNER','ADMIN','MANAGER','STAFF','EMPLOYEE','FINANCE','ACCOUNTANT','FINANCE_MANAGER'])
    )
    or (
      assigned_partner_id = auth.uid()
      and exists (
        select 1 from public.user_memberships mp
        where mp.user_id = auth.uid()
          and mp.tenant_id::text = orders.tenant_id::text
          and mp.status = 'ACTIVE'
      )
    )
  )
);

drop policy if exists support_tickets_select_member on public.support_tickets;
create policy support_tickets_select_member
on public.support_tickets for select to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id::text = support_tickets.tenant_id::text
      and m.status = 'ACTIVE'
  )
  and (
    requester_id = auth.uid()
    or assigned_user_id = auth.uid()
    or exists (
      select 1 from public.user_memberships m2
      where m2.user_id = auth.uid()
        and m2.tenant_id::text = support_tickets.tenant_id::text
        and m2.status = 'ACTIVE'
        and upper(m2.role) = any(array['ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER'])
    )
  )
);

drop policy if exists ticket_messages_select_member on public.ticket_messages;
create policy ticket_messages_select_member
on public.ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    join public.user_memberships m on m.user_id = auth.uid()
      and m.tenant_id::text = t.tenant_id::text and m.status = 'ACTIVE'
    where t.id::text = ticket_messages.ticket_id::text
      and (t.requester_id = auth.uid() or t.assigned_user_id = auth.uid()
        or upper(m.role) = any(array['ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER']))
  )
);

drop policy if exists ticket_messages_insert_member on public.ticket_messages;
create policy ticket_messages_insert_member
on public.ticket_messages for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1 from public.support_tickets t
    join public.user_memberships m on m.user_id = auth.uid()
      and m.tenant_id::text = t.tenant_id::text and m.status = 'ACTIVE'
    where t.id::text = ticket_messages.ticket_id::text
      and (t.requester_id = auth.uid() or t.assigned_user_id = auth.uid()
        or upper(m.role) = any(array['ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','SUPPORT','SUPPORT_MANAGER']))
  )
);
