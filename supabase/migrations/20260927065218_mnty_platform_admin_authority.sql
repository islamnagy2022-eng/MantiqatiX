create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.platform_admins from anon, authenticated;
grant all on table private.platform_admins to service_role;

comment on table private.platform_admins is 'Authoritative MNTY platform-level administrators. Managed only through privileged server-side bootstrap/administration; never used as frontend authorization metadata.';
