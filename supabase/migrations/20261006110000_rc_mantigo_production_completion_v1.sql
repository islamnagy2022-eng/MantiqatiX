-- MantiGO production completion baseline.
-- Applied to Supabase production on 2026-10-06.
-- This migration documents the guarded client contracts, bid lifecycle,
-- captain-safe read RPCs, notifications and realtime publication.

alter table public.mantigo_bids add column if not exists status text not null default 'OFFERED';
alter table public.mantigo_bids drop constraint if exists mantigo_bids_status_check;
alter table public.mantigo_bids add constraint mantigo_bids_status_check check (status in ('OFFERED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED'));
create unique index if not exists mantigo_bids_ride_captain_uq on public.mantigo_bids(ride_id,captain_id);
create index if not exists mantigo_bids_ride_status_idx on public.mantigo_bids(ride_id,status,created_at desc);
create index if not exists mantigo_rides_customer_status_idx on public.mantigo_rides(customer_id,status,updated_at desc);

-- The authoritative functions are deployed in production by the matching
-- RC MantiGO completion migration. Client execution is granted only to
-- authenticated users; each function verifies auth.uid() and actor ownership.
grant execute on function public.create_mantigo_ride_backend(uuid,text,text,text,text,text,text,numeric,text) to authenticated;
grant execute on function public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) to authenticated;
grant execute on function public.accept_mantigo_bid_backend(uuid,text,text) to authenticated;
grant execute on function public.update_mantigo_trip_status_backend(uuid,text,text,text) to authenticated;
grant execute on function public.mantigo_rate_ride(text,integer,text) to authenticated;
grant execute on function public.list_open_mantigo_rides_backend(uuid) to authenticated;
grant execute on function public.list_mantigo_captain_rides_backend(uuid) to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mantigo_rides') then alter publication supabase_realtime add table public.mantigo_rides; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mantigo_bids') then alter publication supabase_realtime add table public.mantigo_bids; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
end $$;
