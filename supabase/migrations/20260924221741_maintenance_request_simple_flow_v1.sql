
alter table public.indrive_requests
  add column if not exists attachment_path text;

alter table public.indrive_bids
  add column if not exists status text not null default 'OFFERED';

alter table public.indrive_bids
  drop constraint if exists indrive_bids_status_check;

alter table public.indrive_bids
  add constraint indrive_bids_status_check
  check (status in ('OFFERED','ACCEPTED','REJECTED'));

create index if not exists idx_indrive_bids_status_request
  on public.indrive_bids(request_id, status);

drop policy if exists mantiqatix_media_maintenance_provider_read on storage.objects;
create policy mantiqatix_media_maintenance_provider_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'mantiqatix-media'
  and coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
  and name like 'users/%/maintenance/%'
  and exists (
    select 1
    from public.indrive_requests r
    where r.attachment_path = objects.name
      and (
        r.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.indrive_bids b
          where b.request_id = r.id
            and b.provider_user_id = auth.uid()
            and b.status in ('OFFERED','ACCEPTED')
        )
        or public.is_platform_admin()
      )
  )
);

drop policy if exists mnt_public_media_anon_read_boundary on storage.objects;
create policy mnt_public_media_anon_read_boundary
on storage.objects
for select
to anon
using (
  bucket_id = 'mantiqatix-media'
  and (name like 'users/%' or name like 'businesses/%')
  and name not like 'users/%/maintenance/%'
);

alter table public.indrive_requests enable row level security;
alter table public.indrive_requests force row level security;
alter table public.indrive_bids enable row level security;
alter table public.indrive_bids force row level security;
