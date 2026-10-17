grant select on public.orders to authenticated;
grant select on public.order_status_history to authenticated;
create policy order_status_history_customer_select_own
on public.order_status_history
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and exists (
    select 1
    from public.orders o
    where o.id = order_status_history.order_id
      and o.customer_id = auth.uid()
  )
);