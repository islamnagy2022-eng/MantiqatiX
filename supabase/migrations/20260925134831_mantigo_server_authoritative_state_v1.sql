create or replace function public.mantigo_update_proposed_price(p_ride_id text, p_new_price numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_new_price is null or p_new_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  update public.mantigo_rides set proposed_price = round(p_new_price, 2), updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status = 'SEARCHING_BIDS';
  if not found then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
end; $$;

create or replace function public.mantigo_accept_bid(p_ride_id text, p_bid_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.mantigo_rides r where r.id = p_ride_id and r.customer_id = (select auth.uid()) and r.status = 'SEARCHING_BIDS') then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
  if not exists (select 1 from public.mantigo_bids b where b.id = p_bid_id and b.ride_id = p_ride_id) then raise exception 'BID_NOT_FOUND'; end if;
  update public.mantigo_rides set status = 'ACCEPTED', accepted_bid_id = p_bid_id, updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status = 'SEARCHING_BIDS';
  if not found then raise exception 'RIDE_STATE_CHANGED'; end if;
end; $$;

create or replace function public.mantigo_cancel_ride(p_ride_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.mantigo_rides set status = 'CANCELLED', updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status not in ('COMPLETED','CANCELLED');
  if not found then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
end; $$;

revoke execute on function public.mantigo_update_proposed_price(text,numeric) from public, anon, authenticated;
revoke execute on function public.mantigo_accept_bid(text,text) from public, anon, authenticated;
revoke execute on function public.mantigo_cancel_ride(text) from public, anon, authenticated;
grant execute on function public.mantigo_update_proposed_price(text,numeric) to authenticated;
grant execute on function public.mantigo_accept_bid(text,text) to authenticated;
grant execute on function public.mantigo_cancel_ride(text) to authenticated;
