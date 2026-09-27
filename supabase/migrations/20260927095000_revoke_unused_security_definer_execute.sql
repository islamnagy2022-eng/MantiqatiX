-- Production security hardening:
-- These SECURITY DEFINER RPCs are not used by the current web or bundled Android clients.
-- Keep them unavailable to client roles until an authenticated client flow is explicitly introduced.
revoke execute on function public.counter_offer_indrive_bid(uuid,uuid,numeric) from authenticated;
revoke execute on function public.fashion_erp_mutate(text,jsonb,text) from authenticated;
revoke execute on function public.mantigo_accept_bid(text,text) from authenticated;
revoke execute on function public.mantigo_cancel_ride(text) from authenticated;
revoke execute on function public.mantigo_create_ride(text,text,text,text,numeric,text) from authenticated;
revoke execute on function public.mantigo_rate_ride(text,integer,text) from authenticated;
revoke execute on function public.mantigo_submit_bid(text,numeric,text,text,text,text) from authenticated;
revoke execute on function public.mantigo_update_proposed_price(text,numeric) from authenticated;
revoke execute on function public.restaurant_erp_mutate(text,jsonb,text) from authenticated;
revoke execute on function public.restaurant_table_mutate(text,jsonb,text) from authenticated;
