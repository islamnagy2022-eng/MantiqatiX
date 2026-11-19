-- Disposable negative fixture: add unreviewed permissive SELECT policies to both tables.
-- RC465 must reject this schema before replacing any policy.
CREATE POLICY rc465_unexpected_orders_select
ON public.orders FOR SELECT TO authenticated USING (true);

CREATE POLICY rc465_unexpected_history_select
ON public.order_status_history FOR SELECT TO authenticated USING (true);
