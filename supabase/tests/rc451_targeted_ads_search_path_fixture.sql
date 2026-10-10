-- Disposable PostgreSQL fixture for RC451 only.
create role anon nologin;
create role authenticated nologin;

create or replace function public.get_mnty_targeted_advertisements(
  character varying,
  character varying,
  character varying,
  double precision,
  double precision,
  character varying,
  integer
)
returns table(
  advertisement_id character varying,
  title character varying,
  creative_url text,
  target_url text,
  ad_space_id character varying,
  match_level character varying,
  distance_km double precision
)
language sql
security definer
set search_path = public, pg_temp
as $function$
  select null::varchar,null::varchar,null::text,null::text,null::varchar,null::varchar,null::double precision
  where false
$function$;

revoke all on function public.get_mnty_targeted_advertisements(varchar,varchar,varchar,double precision,double precision,varchar,integer) from public;
grant execute on function public.get_mnty_targeted_advertisements(varchar,varchar,varchar,double precision,double precision,varchar,integer) to anon, authenticated;
