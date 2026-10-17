drop policy if exists "account_registration_requests_platform_update" on public.account_registration_requests;
comment on table public.account_registration_requests is
'Registration decisions are server-authoritative through the mnty-registration-review Edge Function and private.review_registration_request_atomic; clients may create/read within RLS scope but cannot directly mutate review state.';