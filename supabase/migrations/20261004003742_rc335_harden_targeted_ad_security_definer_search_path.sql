-- RC335: harden the intentional public targeted-ad SECURITY DEFINER boundary.
-- The RPC remains publicly callable because it is the advertisement-serving contract.
-- Tighten the function search path to prevent untrusted objects from shadowing names.
alter function public.get_mnty_targeted_advertisements(
  varchar,
  varchar,
  varchar,
  double precision,
  double precision,
  varchar,
  integer
) set search_path = public, pg_temp;
