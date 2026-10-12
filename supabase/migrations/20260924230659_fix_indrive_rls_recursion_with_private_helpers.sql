
create schema if not exists private;

create or replace function private.can_read_indrive_request(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.indrive_requests r
    where r.id = p_request_id
      and (
        r.owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.indrive_bids b
          where b.request_id = r.id
            and b.provider_user_id = (select auth.uid())
            and b.status in ('OFFERED','ACCEPTED')
        )
        or public.is_platform_admin()
      )
  );
$$;

create or replace function private.can_read_indrive_bid(p_request_id uuid, p_provider_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    p_provider_user_id = (select auth.uid())
    or exists (
      select 1
      from public.indrive_requests r
      where r.id = p_request_id
        and r.owner_user_id = (select auth.uid())
    )
    or public.is_platform_admin();
$$;

create or replace function private.can_submit_indrive_bid(p_request_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.indrive_requests r
    where r.id = p_request_id
      and r.status = 'OPEN_FOR_BIDS'
      and r.owner_user_id <> (select auth.uid())
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.can_read_indrive_request(uuid) from public, anon;
revoke all on function private.can_read_indrive_bid(uuid,uuid) from public, anon;
revoke all on function private.can_submit_indrive_bid(uuid) from public, anon;
grant execute on function private.can_read_indrive_request(uuid) to authenticated;
grant execute on function private.can_read_indrive_bid(uuid,uuid) to authenticated;
grant execute on function private.can_submit_indrive_bid(uuid) to authenticated;

drop policy if exists indrive_requests_select on public.indrive_requests;
create policy indrive_requests_select
on public.indrive_requests
for select
to authenticated
using (
  coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
  and (select private.can_read_indrive_request(id))
);

drop policy if exists indrive_bids_select on public.indrive_bids;
create policy indrive_bids_select
on public.indrive_bids
for select
to authenticated
using (
  coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
  and (select private.can_read_indrive_bid(request_id, provider_user_id))
);

drop policy if exists indrive_bids_insert on public.indrive_bids;
create policy indrive_bids_insert
on public.indrive_bids
for insert
to authenticated
with check (
  provider_user_id = auth.uid()
  and status = 'OFFERED'
  and (select private.can_submit_indrive_bid(request_id))
);

drop policy if exists indrive_bids_update on public.indrive_bids;
create policy indrive_bids_update
on public.indrive_bids
for update
to authenticated
using (
  coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
  and (select private.can_read_indrive_bid(request_id, provider_user_id))
)
with check (
  coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
  and (select private.can_read_indrive_bid(request_id, provider_user_id))
);
