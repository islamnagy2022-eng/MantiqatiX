-- Restore the authenticated used-item directory read contract without exposing seller contact data.
-- RLS remains the row-level authorization boundary; column grants keep seller_phone inaccessible.
begin;

revoke select on table public.used_item_ads from anon, authenticated;

grant select (
  id,
  owner_user_id,
  tenant_id,
  business_id,
  title,
  category,
  price,
  seller_name,
  location,
  is_sold,
  created_at
) on table public.used_item_ads to authenticated;

commit;
