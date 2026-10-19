-- RC454: enforce marketing partner allocation integrity at the database boundary.
-- The campaign row lock serializes allocation checks for writes to the same campaign.
create or replace function public.mnty_guard_marketing_partner_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign_business_id uuid;
  v_campaign_tenant_id character varying;
  v_campaign_status character varying;
  v_allocated numeric;
begin
  select c.business_id,c.tenant_id,c.status
    into v_campaign_business_id,v_campaign_tenant_id,v_campaign_status
  from public.marketing_campaigns c
  where c.id = new.campaign_id
  for update;

  if not found then
    raise exception 'MARKETING_CAMPAIGN_NOT_FOUND';
  end if;

  if new.business_id is distinct from v_campaign_business_id
     or new.tenant_id is distinct from v_campaign_tenant_id then
    raise exception 'MARKETING_PARTICIPANT_SCOPE_MISMATCH';
  end if;

  if new.status in ('INVITED','ACCEPTED','ACTIVE') then
    if v_campaign_status in ('COMPLETED','CANCELLED') then
      raise exception 'MARKETING_CAMPAIGN_LOCKED';
    end if;

    select coalesce(sum(cp.allocation_percent),0)
      into v_allocated
    from public.marketing_campaign_participants cp
    where cp.campaign_id = new.campaign_id
      and cp.id is distinct from new.id
      and cp.status in ('INVITED','ACCEPTED','ACTIVE');

    if v_allocated + new.allocation_percent > 100 then
      raise exception 'MARKETING_ALLOCATION_OVER_100';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists mnty_guard_marketing_partner_allocation
  on public.marketing_campaign_participants;

create trigger mnty_guard_marketing_partner_allocation
before insert or update of campaign_id,business_id,tenant_id,allocation_percent
on public.marketing_campaign_participants
for each row
execute function public.mnty_guard_marketing_partner_allocation();

revoke all on function public.mnty_guard_marketing_partner_allocation() from public, anon, authenticated;
