drop policy if exists mantigo_rides_update on public.mantigo_rides;
drop policy if exists mantigo_bids_update on public.mantigo_bids;
revoke update on public.mantigo_rides from anon,authenticated;
revoke update on public.mantigo_bids from anon,authenticated;
