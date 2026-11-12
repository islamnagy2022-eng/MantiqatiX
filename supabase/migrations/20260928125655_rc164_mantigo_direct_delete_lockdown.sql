drop policy if exists mantigo_rides_delete on public.mantigo_rides;
drop policy if exists mantigo_bids_delete on public.mantigo_bids;
revoke delete on public.mantigo_rides from anon,authenticated;
revoke delete on public.mantigo_bids from anon,authenticated;
