-- Keep platform administrator authority server-only.
-- No public/authenticated RLS policies are defined intentionally.
alter table private.platform_admins enable row level security;
