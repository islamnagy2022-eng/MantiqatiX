alter table public.business_subscriptions force row level security;
revoke insert, update, delete on public.business_subscriptions from anon, authenticated;
grant select on public.business_subscriptions to authenticated;
