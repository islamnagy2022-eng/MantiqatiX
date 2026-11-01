-- Private evidence registry for doctor-directory republication permissions.
-- Evidence references are internal contract IDs or private-storage object keys; never expose them publicly.
create table if not exists public.directory_source_permission_evidence (
  id uuid primary key default gen_random_uuid(),
  source_name text not null check (char_length(trim(source_name)) between 2 and 160),
  source_host text not null check (char_length(trim(source_host)) between 3 and 253),
  permission_basis text not null check (permission_basis in ('LICENSED','OWNER_PROVIDED','PUBLIC_PERMISSION_CONFIRMED')),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 3 and 500),
  evidence_sha256 text,
  allows_doctor_profile_republication boolean not null default false,
  allows_commercial_republication boolean not null default false,
  valid_from timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REVOKED')),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint directory_source_permission_evidence_sha256_check
    check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-fA-F]{64}$'),
  constraint directory_source_permission_evidence_approval_check
    check (
      (status <> 'APPROVED' or (approved_by is not null and approved_at is not null))
      and (status <> 'REVOKED' or (revoked_by is not null and revoked_at is not null))
    ),
  constraint directory_source_permission_evidence_two_person_check
    check (approved_by is null or approved_by <> created_by),
  constraint directory_source_permission_evidence_expiry_check
    check (expires_at is null or expires_at > valid_from)
);

create index if not exists directory_source_permission_evidence_host_status_idx
  on public.directory_source_permission_evidence (source_host, status, valid_from desc);

create index if not exists directory_source_permission_evidence_expiry_idx
  on public.directory_source_permission_evidence (expires_at)
  where status = 'APPROVED' and expires_at is not null;

drop trigger if exists trg_directory_source_permission_evidence_updated_at
  on public.directory_source_permission_evidence;
create trigger trg_directory_source_permission_evidence_updated_at
before update on public.directory_source_permission_evidence
for each row execute function public.set_public_directory_updated_at();

alter table public.directory_source_permission_evidence enable row level security;
alter table public.directory_source_permission_evidence force row level security;
revoke all on table public.directory_source_permission_evidence from anon, authenticated;
grant all on table public.directory_source_permission_evidence to service_role;

comment on table public.directory_source_permission_evidence is
  'Private two-person-reviewed evidence registry for doctor-directory republication; service-role access only.';
comment on column public.directory_source_permission_evidence.evidence_reference is
  'Private storage object key or internal contract/consent reference, not a public URL.';
