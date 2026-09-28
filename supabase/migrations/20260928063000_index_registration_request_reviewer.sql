-- Improve lookup performance for registration requests reviewed by a platform administrator.
create index if not exists idx_account_registration_requests_reviewed_by
  on public.account_registration_requests (reviewed_by);
