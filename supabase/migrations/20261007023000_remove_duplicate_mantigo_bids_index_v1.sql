-- Remove the duplicate MantiGO bids index.
-- Keep idx_mantigo_bids_ride_status_created, which is the canonical source index.
drop index if exists public.mantigo_bids_ride_status_idx;
