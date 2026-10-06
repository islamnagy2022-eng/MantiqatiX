-- Reverse bidding server authority v1.
-- Direct client writes are closed; authenticated callers use validated backend RPCs.
alter table public.indrive_requests add column if not exists idempotency_key text;
create unique index if not exists indrive_requests_owner_idempotency_uq
  on public.indrive_requests(owner_user_id,idempotency_key)
  where idempotency_key is not null;
create unique index if not exists indrive_bids_request_provider_uq
  on public.indrive_bids(request_id,provider_user_id);

revoke insert, update on public.indrive_requests from anon, authenticated;
revoke insert, update, delete on public.indrive_bids from anon, authenticated;

create or replace function public.create_indrive_request_backend(
  p_user_id uuid,p_domain_type text,p_category_name text,p_title text,
  p_details_description text,p_user_proposed_price numeric,
  p_target_provider_type text,p_req_location_district text,p_idempotency_key text
) returns public.indrive_requests
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid:=auth.uid(); v_existing public.indrive_requests; v_row public.indrive_requests;
begin
  if v_user is null or v_user<>p_user_id or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  if nullif(trim(p_title),'') is null or nullif(trim(p_details_description),'') is null then raise exception 'request_details_required'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'idempotency_key_required'; end if;
  select * into v_existing from public.indrive_requests where owner_user_id=v_user and idempotency_key=p_idempotency_key limit 1;
  if found then return v_existing; end if;
  insert into public.indrive_requests(id,owner_user_id,domain_type,category_name,title,details_description,user_proposed_price,target_provider_type,selected_ad_platform,req_location_district,status,idempotency_key)
  values(gen_random_uuid(),v_user,upper(trim(p_domain_type)),nullif(trim(p_category_name),''),trim(p_title),trim(p_details_description),greatest(coalesce(p_user_proposed_price,0),0),nullif(trim(p_target_provider_type),''),'MNTY',nullif(trim(p_req_location_district),''),'OPEN_FOR_BIDS',p_idempotency_key)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.create_indrive_bid_backend(
  p_user_id uuid,p_request_id uuid,p_provider_name text,p_provider_type text,
  p_offered_price numeric,p_note text,p_estimated_delivery_time text
) returns public.indrive_bids
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_user uuid:=auth.uid(); v_req public.indrive_requests; v_row public.indrive_bids;
begin
  if v_user is null or v_user<>p_user_id or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if;
  if p_offered_price is null or p_offered_price<0 then raise exception 'invalid_price'; end if;
  select * into v_req from public.indrive_requests where id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.owner_user_id=v_user then raise exception 'request_owner_cannot_bid'; end if;
  if v_req.status not in ('OPEN','OPEN_FOR_BIDS','MATCHING') then raise exception 'request_not_open'; end if;
  insert into public.indrive_bids(id,request_id,provider_user_id,provider_name,provider_type,provider_rating,completed_orders_count,offered_price,note,estimated_delivery_time,status)
  values(gen_random_uuid(),p_request_id,v_user,nullif(trim(p_provider_name),''),nullif(trim(p_provider_type),''),null,0,p_offered_price,nullif(trim(p_note),''),nullif(trim(p_estimated_delivery_time),''),'PENDING')
  returning * into v_row;
  return v_row;
exception when unique_violation then raise exception 'BID_ALREADY_EXISTS';
end $$;

revoke all on function public.create_indrive_request_backend(uuid,text,text,text,text,numeric,text,text,text) from public,anon;
grant execute on function public.create_indrive_request_backend(uuid,text,text,text,text,numeric,text,text,text) to authenticated;
revoke all on function public.create_indrive_bid_backend(uuid,uuid,text,text,numeric,text,text) from public,anon;
grant execute on function public.create_indrive_bid_backend(uuid,uuid,text,text,numeric,text,text) to authenticated;
