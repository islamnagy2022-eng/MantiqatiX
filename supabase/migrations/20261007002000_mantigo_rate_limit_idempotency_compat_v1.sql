-- Preserve idempotent ride replays even when the actor has reached the creation rate limit.
create or replace function public.mantigo_guard_ride_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is not null and new.idempotency_key is not null
     and exists (
       select 1 from public.mantigo_rides
       where customer_id = new.customer_id
         and idempotency_key = new.idempotency_key
     ) then
    return new;
  end if;

  perform public.mantigo_rate_limit_check('CREATE_RIDE', new.customer_id);
  return new;
end;
$$;

revoke all on function public.mantigo_guard_ride_rate_limit() from public, anon, authenticated;
