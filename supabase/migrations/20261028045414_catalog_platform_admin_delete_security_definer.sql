-- Execute the deletion guard and cleanup with the function owner so protected
-- business/order/finance tables need not be exposed to service_role. The Edge
-- Function performs the platform-admin and tenant-scope authorization first.
ALTER FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) SECURITY DEFINER;
ALTER FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) SET search_path = '';

REVOKE ALL ON FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) TO service_role;
