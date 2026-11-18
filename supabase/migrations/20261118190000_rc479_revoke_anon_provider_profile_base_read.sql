-- RC479: remove direct anonymous PostgREST reads from the provider-profile base table.
-- Public discovery continues through the curated service-role Edge Functions.
-- Authenticated owner/admin workflows and trusted backend reads are preserved.
REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;
