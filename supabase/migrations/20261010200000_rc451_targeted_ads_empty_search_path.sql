-- RC451: remove public-schema resolution from the intentionally public targeted-ad read RPC.
-- The function body schema-qualifies application tables; pg_catalog remains implicitly searchable.
-- Preserve anon execution because public ad discovery is an intentional product capability.
-- This migration changes only function configuration; it does not alter data or grants.
alter function public.get_mnty_targeted_advertisements(
  character varying,
  character varying,
  character varying,
  double precision,
  double precision,
  character varying,
  integer
) set search_path = '';
