-- Harden the notification read boundary and expose the existing backend RPC to authenticated clients.
-- The RPC derives ownership from auth.uid(); the browser must not update notifications directly.
alter function public.mark_notifications_read_backend(character varying)
  set search_path = public, pg_temp;

revoke execute on function public.mark_notifications_read_backend(character varying) from public, anon, authenticated;
grant execute on function public.mark_notifications_read_backend(character varying) to authenticated;
