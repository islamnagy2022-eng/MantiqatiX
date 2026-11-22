# Pass 1731–1740 — Live Supabase schema, Storage and security-advisor review

Date: 2026-11-22  
Project: `MANTIQATIX FINAL` (`moyhiluyhjsujhwlyeuu`)  
Method: read-only Supabase project/table/migration/advisor inventory and read-only SQL against PostgreSQL catalogs and Storage metadata. No application rows, user identities, phone numbers, payment values, or media object contents were selected.

## Verified live baseline

- Supabase project status: `ACTIVE_HEALTHY`; PostgreSQL 17.6.1.155.
- Applied migration ledger: **310 rows**, latest `20261110150618` (`revoke_public_execute_from_trigger_functions`). The live ledger is behind the current repository's forward migration chain; source/CI replay does not imply those later migrations have been applied to Production.
- Public/private schema table inventory: no general business/storefront/product/service review table was found by live table metadata and catalog-name inventory.
- The only review/rating-named application table found is `public.mantigo_ride_ratings`, with `ride_id`, `customer_id`, `captain_id`, integer `rating`, `comment`, and `created_at`. It is scoped to MantiGO rides and must not be reused as a public business review model.
- Storage buckets:
  - `mantiqatix-media`: private, 5 MiB maximum, JPEG/PNG/WebP only.
  - `mantiqatix-profile-media`: public-read, 5 MiB maximum, JPEG/PNG/WebP/SVG only.
- No video MIME type or video-specific bucket was observed. Do not advertise video/reels upload as currently supported.
- Storage object RLS is enabled. Private media policies are authenticated-session and owner/business-path scoped. Profile media has explicit public SELECT and owner-path authenticated write/delete policies. Platform-brand Storage policies in the live catalog still show an ACTIVE `SUPER_ADMIN` membership predicate; this is a known source/live authorization reconciliation item, not an instruction to mutate Production in this pass.

## Current Security Advisor findings

Read at 2026-11-22T00:45Z:

- 9 relations report RLS enabled with no policy: `business_employees`, `business_job_positions`, `commission_rule_audit`, `digital_page_payment_events`, `directory_listing_claim_requests`, `directory_source_permission_evidence`, `platform_custom_roles`, `platform_role_assignments`, and `public_directory_listings`.
- 1 anonymous-callable SECURITY DEFINER function: `public.get_mnty_targeted_advertisements(...)`. This is the known public ad-delivery RPC; preserve it only with its public-output allowlist and dedicated adversarial contract tests.
- 65 authenticated-callable SECURITY DEFINER functions remain in the Advisor list. The Advisor count is an inventory, not proof of vulnerability; each function still needs body/call-chain authorization review.
- A direct read-only grant/policy cross-check on all nine relations returned **no direct anon or authenticated table grants and no policies**. This supports a backend-only access boundary at the SQL table layer; the Advisor's RLS-no-policy INFO findings are not proof of direct public exposure. Keep access through separately authorized service-role/Edge paths and preserve negative direct-access tests.
- These findings do not justify blanket RLS policies or blanket EXECUTE revocation. Several tables are backend-only by design and broad changes could break legitimate server-side operations.

## Li2Lak-relevant product gaps established by live evidence

1. General business/storefront/product/service reviews are not present as a dedicated live schema contract. Do not show invented stars, review counts or testimonials.
2. General video uploads are not supported by current Storage bucket configuration. Existing media upload paths are limited to current image contracts; a video feature needs a separately designed, owner-scoped, quota-limited and tested media lifecycle.
3. Existing MantiGO ride ratings are a distinct workflow and remain separate.

## Next safe engineering actions

- Complete source/live reconciliation for the nine RLS-enabled/no-policy tables and 65 authenticated SECURITY DEFINER functions, prioritizing owner/tenant/business/branch authorization.
- Review and repair the platform-brand Storage authorization mismatch through a forward-only migration, disposable PostgreSQL/Storage tests, and exact migration replay; do not apply directly to Production.
- If general business reviews are approved as a product feature, design a separate append-only/verified-purchase or verified-interaction review model with moderation, business response permissions, abuse controls, aggregate rules, audit and RLS. No table or migration is created in this pass.
- If video media is approved, design a separate private bucket/Edge upload path with MIME sniffing, strict byte/duration limits, owner/business authorization, signed playback or explicit publication, cleanup and malware/content review. No bucket or policy change is created in this pass.

## Disposition

Read-only review only. No database DDL/data, Auth, RLS, GRANT, Storage bucket/policy, Edge Function, payment, wallet, user data, or production deployment was changed. **PRODUCTION BLOCKED / NOT CERTIFIED.**


## Source/Production reconciliation clarification

- Repository migration `20261121020000_rc495_storage_filename_regex_forward_repair.sql` already repairs the platform-brand INSERT/UPDATE/DELETE policies to call `public.mnty_can_platform_admin()` and corrects filename suffix predicates. The source validator is `scripts/validate-rc495-storage-filename-regex-forward-repair.mjs`; the isolated migration replay workflow includes the RC495 SQL regression test and a test-only overlay reproducing the known live policy state.
- Live Production has not applied RC488–RC496: its migration ledger still ends at `20261110150618`. Therefore the remaining gap is coordinated release/rollout verification, not missing source implementation. Do not create a duplicate migration.
- The live public ads RPC body was inspected read-only: it uses an empty search_path, returns approved/active scheduled ad fields only, filters to the requested ad space and country/geo targeting, and clamps the result limit to 1–50. Its anonymous EXECUTE is intentional for public ad display and must remain covered by its dedicated contract tests.
- Direct grants and policies on the nine RLS-enabled/no-policy tables were checked individually: no direct `anon` or `authenticated` table grants and no policies were returned. Keep these as backend-only relations unless a specific client read contract is designed and tested.
