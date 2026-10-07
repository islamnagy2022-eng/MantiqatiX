-- RC375: rate-limit checker is an internal trigger boundary, not a client API.
revoke execute on function public.mantigo_rate_limit_check(text,uuid) from public, anon, authenticated;
