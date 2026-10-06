-- MantiGO state integrity constraints v1
-- Prevents a bid from being accepted for multiple rides and restricts ride states to the supported state machine.

create unique index if not exists mantigo_rides_accepted_bid_uq
  on public.mantigo_rides (accepted_bid_id)
  where accepted_bid_id is not null;

alter table public.mantigo_rides
  drop constraint if exists mantigo_rides_status_check;

alter table public.mantigo_rides
  add constraint mantigo_rides_status_check
  check (status in (
    'OPEN','OPEN_FOR_BIDS','MATCHING','ACCEPTED','ARRIVED','STARTED',
    'IN_PROGRESS','COMPLETED','CANCELLED','FAILED','SHOW_NO','EXPIRED'
  ));
