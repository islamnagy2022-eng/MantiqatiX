alter function public.mantigo_accept_bid(text,text) set search_path = public, pg_temp;
alter function public.mantigo_cancel_ride(text) set search_path = public, pg_temp;
alter function public.mantigo_create_ride(text,text,text,text,numeric,text) set search_path = public, pg_temp;
alter function public.mantigo_submit_bid(text,numeric,text,text,text,text) set search_path = public, pg_temp;
alter function public.mantigo_update_proposed_price(text,numeric) set search_path = public, pg_temp;

revoke execute on function public.mantigo_accept_bid(text,text) from public, anon, authenticated;
revoke execute on function public.mantigo_cancel_ride(text) from public, anon, authenticated;
revoke execute on function public.mantigo_create_ride(text,text,text,text,numeric,text) from public, anon, authenticated;
revoke execute on function public.mantigo_submit_bid(text,numeric,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.mantigo_update_proposed_price(text,numeric) from public, anon, authenticated;
