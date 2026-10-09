-- RC440 disposable fixture for exposed SECURITY DEFINER search-path hardening.
create function public.rc440_exposed_probe()
returns integer language sql security definer set search_path=public
as $function$ select 1 $function$;
revoke all on function public.rc440_exposed_probe() from public,anon,authenticated;
grant execute on function public.rc440_exposed_probe() to anon;

create function public.rc440_private_probe()
returns integer language sql security definer set search_path=public
as $function$ select 1 $function$;
revoke all on function public.rc440_private_probe() from public,anon,authenticated;
grant execute on function public.rc440_private_probe() to service_role;
