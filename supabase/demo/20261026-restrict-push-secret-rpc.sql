-- DEMO-only restriction for a SECURITY DEFINER RPC that returns decrypted Vault secrets.
-- Production currently restricts this function to service_role; preserve that boundary in DEMO.
-- Never apply this file to LIVE.
revoke all on function public.get_mnty_push_secrets() from public, anon, authenticated;
grant execute on function public.get_mnty_push_secrets() to service_role;
