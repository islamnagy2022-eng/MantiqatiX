-- MantiGO acceptance integrity trigger v1
-- Enforces that accepted_bid_id belongs to the same ride and is actually ACCEPTED.
create or replace function public.validate_mantigo_ride_acceptance_integrity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_bid_ride text; v_bid_status text;
begin
  if new.accepted_bid_id is null then
    if new.status='ACCEPTED' then raise exception 'ACCEPTED_RIDE_REQUIRES_ACCEPTED_BID'; end if;
    return new;
  end if;
  select ride_id,status into v_bid_ride,v_bid_status from public.mantigo_bids where id=new.accepted_bid_id;
  if v_bid_ride is null then raise exception 'ACCEPTED_BID_NOT_FOUND'; end if;
  if v_bid_ride<>new.id then raise exception 'ACCEPTED_BID_RIDE_MISMATCH'; end if;
  if v_bid_status<>'ACCEPTED' then raise exception 'ACCEPTED_BID_STATUS_INVALID'; end if;
  return new;
end $$;

drop trigger if exists mantigo_ride_acceptance_integrity_trg on public.mantigo_rides;
create trigger mantigo_ride_acceptance_integrity_trg
before insert or update of accepted_bid_id,status on public.mantigo_rides
for each row execute function public.validate_mantigo_ride_acceptance_integrity();

revoke all on function public.validate_mantigo_ride_acceptance_integrity() from public,anon,authenticated;
