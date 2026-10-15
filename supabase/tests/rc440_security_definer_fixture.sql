-- RC440 disposable fixture for exposed SECURITY DEFINER search-path hardening.
create table public.rc440_guarded_data(value integer not null);
insert into public.rc440_guarded_data(value) values (10);

create function public.rc440_exposed_probe()
returns integer language sql security definer set search_path=public
as $function$ select value from rc440_guarded_data limit 1 $function$;
revoke all on function public.rc440_exposed_probe() from public,anon,authenticated;
grant execute on function public.rc440_exposed_probe() to anon;

create function public.rc440_authenticated_probe()
returns integer language sql security definer set search_path=public
as $function$ select 2 $function$;
revoke all on function public.rc440_authenticated_probe() from public,anon,authenticated;
grant execute on function public.rc440_authenticated_probe() to authenticated;

create function public.rc440_already_hardened_probe()
returns integer language sql security definer set search_path=public, pg_temp
as $function$ select 3 $function$;
revoke all on function public.rc440_already_hardened_probe() from public,anon,authenticated;
grant execute on function public.rc440_already_hardened_probe() to authenticated;

create function public.rc440_private_probe()
returns integer language sql security definer set search_path=public
as $function$ select 4 $function$;
revoke all on function public.rc440_private_probe() from public,anon,authenticated;
grant execute on function public.rc440_private_probe() to service_role;
