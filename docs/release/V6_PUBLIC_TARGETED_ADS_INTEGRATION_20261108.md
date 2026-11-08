# V6 public sponsored-ad integration — 2026-11-08

## Production read-only evidence

Project: `moyhiluyhjsujhwlyeuu` (ACTIVE_HEALTHY). No database writes, migrations, grants or Edge Function changes were made.

The live function was inspected through PostgreSQL:

- Function: `public.get_mnty_targeted_advertisements(varchar,varchar,varchar,double precision,double precision,varchar,integer)`.
- Returns only: `advertisement_id`, `title`, `creative_url`, `target_url`, `ad_space_id`, `match_level`, `distance_km`.
- `SECURITY DEFINER` with `search_path = ''`.
- `anon` and `authenticated` can execute it by design for public advertisement delivery.
- Function filters regular advertisements and global advertisements to `ACTIVE`, `APPROVED`, and valid start/end times; it clamps result limit to 1–50.

Live RPC check on 2026-11-08:

- `HOME_SPONSORED`: **4 records** returned for Egypt-wide fallback.
- `HOME_HERO`: **0 records** returned.
- Global active/approved/date-valid rows: 4.
- Active/approved/date-valid normal ad rows: 0.
- No geographic targeting row is claimed; current observed results are global fallback placements.

The Egyptian governorate code set used by the function was read from `public.platform_geo_areas`. Monufia is code `17`; the UI's display label is not sent as the database code.

## Implementation

The new public Preview rail calls only the existing read-only RPC:

`POST /rest/v1/rpc/get_mnty_targeted_advertisements`

with:

- `p_country_code=EG`
- `p_governorate_code` mapped to the authoritative two-digit code, or null for all governorates
- `p_ad_space_id=HOME_SPONSORED`
- `p_limit=8`

The public browser uses only the existing Supabase publishable/anon key. It never uses the service-role key. Legacy anon JWTs receive an Authorization bearer header; opaque `sb_publishable_` keys use the `apikey` header.

Client-side output validation rejects duplicate IDs, missing fields, non-HTTPS creative/target URLs, unexpected placement IDs, and unknown match levels. Links are marked `rel="sponsored noopener noreferrer"` and open in a separate tab. On API failure or an empty result, the rail stays hidden and the directory continues working.

## Test and release boundary

- Unit tests cover RPC request scope, Egypt/Monufia codes, public key handling, URL allowlisting, duplicate filtering, placement filtering and empty responses.
- Browser E2E mocks the RPC with synthetic fixture rows only, asserts that exactly four `HOME_SPONSORED` items render, rejects a different placement, and verifies that selecting Monufia sends code `17`.
- The Pages workflow now performs a live RPC CORS preflight and a live sanitized-output smoke test against the production public RPC.
- No ad rows were created or changed. No database mutation was performed.
- The rail will show only whatever active, approved, date-valid `HOME_SPONSORED` rows the existing RPC returns at runtime; it does not embed the four observed creatives as fallback content.
