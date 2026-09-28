-- RC199: allow a customer to read only their own marketplace orders across provider tenants.
-- No UPDATE/DELETE/INSERT privilege is added by this policy.
create policy orders_customer_select_own
on public.orders
for select
to authenticated
using (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  and customer_id = auth.uid()
);
