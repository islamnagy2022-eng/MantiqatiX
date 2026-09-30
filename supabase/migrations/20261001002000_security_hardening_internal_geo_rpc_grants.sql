-- These provider-geo RPCs are not referenced by the current production web client.
-- Keep them internal until a server-authorized caller is explicitly introduced.
revoke execute on function public.find_mnty_nearby_provider_businesses(double precision,double precision,double precision) from authenticated;
revoke execute on function public.find_mnty_nearest_provider_businesses(double precision,double precision,integer) from authenticated;
