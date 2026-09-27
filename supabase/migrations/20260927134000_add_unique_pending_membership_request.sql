create unique index if not exists account_registration_requests_pending_role_uidx
on public.account_registration_requests(user_id,requested_role)
where status='PENDING';
