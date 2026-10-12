
create or replace function public.guard_indrive_server_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user in ('postgres','service_role') then
    return new;
  end if;

  if tg_table_name = 'indrive_bids' then
    if new.id is distinct from old.id
       or new.request_id is distinct from old.request_id
       or new.provider_user_id is distinct from old.provider_user_id
       or new.status is distinct from old.status then
      raise exception 'BID_SERVER_FIELDS_ONLY';
    end if;
  elsif tg_table_name = 'indrive_requests' then
    if new.id is distinct from old.id
       or new.owner_user_id is distinct from old.owner_user_id
       or new.status is distinct from old.status
       or new.accepted_bid_id is distinct from old.accepted_bid_id then
      raise exception 'REQUEST_SERVER_FIELDS_ONLY';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_indrive_bids_server_fields on public.indrive_bids;
create trigger trg_indrive_bids_server_fields
before update on public.indrive_bids
for each row execute function public.guard_indrive_server_fields();

drop trigger if exists trg_indrive_requests_server_fields on public.indrive_requests;
create trigger trg_indrive_requests_server_fields
before update on public.indrive_requests
for each row execute function public.guard_indrive_server_fields();

drop policy if exists indrive_bids_insert on public.indrive_bids;
create policy indrive_bids_insert
on public.indrive_bids
for insert
to authenticated
with check (
  provider_user_id = auth.uid()
  and status = 'OFFERED'
  and exists (
    select 1
    from public.indrive_requests r
    where r.id = indrive_bids.request_id
      and r.status = 'OPEN_FOR_BIDS'
      and r.owner_user_id <> auth.uid()
  )
);

drop policy if exists indrive_requests_insert on public.indrive_requests;
create policy indrive_requests_insert
on public.indrive_requests
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and status = 'OPEN_FOR_BIDS'
);
