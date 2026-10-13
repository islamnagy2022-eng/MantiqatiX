create or replace function public.accept_indrive_bid(p_request_id uuid, p_bid_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_owner_user_id uuid; v_request_status text; v_bid_request_id uuid; v_bid_status text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select owner_user_id,status into v_owner_user_id,v_request_status from public.indrive_requests where id=p_request_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 if v_owner_user_id <> auth.uid() and not public.is_platform_admin() then raise exception 'REQUEST_OWNER_REQUIRED'; end if;
 if v_request_status='BID_ACCEPTED' then raise exception 'REQUEST_ALREADY_ACCEPTED'; end if;
 select request_id,status into v_bid_request_id,v_bid_status from public.indrive_bids where id=p_bid_id for update;
 if not found or v_bid_request_id<>p_request_id then raise exception 'BID_NOT_FOUND'; end if;
 if v_bid_status<>'OFFERED' then raise exception 'BID_NOT_OFFERED'; end if;
 update public.indrive_bids set status='ACCEPTED' where id=p_bid_id;
 update public.indrive_bids set status='REJECTED' where request_id=p_request_id and id<>p_bid_id and status='OFFERED';
 update public.indrive_requests set status='BID_ACCEPTED',accepted_bid_id=p_bid_id where id=p_request_id;
end; $$;
create or replace function public.reject_indrive_bid(p_request_id uuid,p_bid_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_owner_user_id uuid; v_bid_request_id uuid; v_bid_status text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select owner_user_id into v_owner_user_id from public.indrive_requests where id=p_request_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
 if v_owner_user_id <> auth.uid() and not public.is_platform_admin() then raise exception 'REQUEST_OWNER_REQUIRED'; end if;
 select request_id,status into v_bid_request_id,v_bid_status from public.indrive_bids where id=p_bid_id for update;
 if not found or v_bid_request_id<>p_request_id then raise exception 'BID_NOT_FOUND'; end if;
 if v_bid_status<>'OFFERED' then raise exception 'BID_NOT_OFFERED'; end if;
 update public.indrive_bids set status='REJECTED' where id=p_bid_id;
end; $$;
revoke all on function public.accept_indrive_bid(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reject_indrive_bid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.accept_indrive_bid(uuid,uuid) to authenticated;
grant execute on function public.reject_indrive_bid(uuid,uuid) to authenticated;
revoke update on public.indrive_bids from authenticated;
grant update (offered_price,note) on public.indrive_bids to authenticated;
