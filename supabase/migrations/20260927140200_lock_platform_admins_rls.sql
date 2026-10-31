-- platform_admins is server-authoritative and must never be readable/writable
-- through the public Supabase API. Privileged SECURITY DEFINER routines and
-- service-role operations retain access; anon/authenticated clients do not.
alter table private.platform_admins enable row level security;