-- RC199: allow a customer to read only their own marketplace orders across provider tenants.
-- Read-only browser access; no client INSERT/UPDATE/DELETE privileges are added.
create policy orders_customer_select_own
on public.orders
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and customer_id = auth.uid()
);

-- The web order workspace reads these relations directly through the authenticated
-- Supabase client. Keep the table privileges read-only and rely on RLS for row scope.
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
