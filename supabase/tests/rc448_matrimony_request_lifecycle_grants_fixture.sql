-- Disposable-only fixture: emulate the pre-RC448 authenticated DML grants found in production.
-- Never run this file against a hosted or production database.
grant insert,update,delete on public.matrimony_requests to authenticated;
grant insert,update,delete on public.matrimony_contact_unlocks to authenticated;
