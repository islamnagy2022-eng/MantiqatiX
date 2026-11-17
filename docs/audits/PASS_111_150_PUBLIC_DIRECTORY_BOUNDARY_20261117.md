# Pass 111–150 — Public directory output-boundary review
Date: 2026-11-17
Base: current-main PR #756 branch
Scope: read-only review of the separate national `directory-listings` public API after the focused catalog contact-consent change.

## Pass results

### 111–120 — Public read surface
- Pass 111: identified the slug-detail GET path.
- Pass 112: confirmed slug-detail reads require `listing_status=PUBLISHED`.
- Pass 113: confirmed the endpoint uses an explicit `publicFields` column list.
- Pass 114: confirmed the slug-detail path adds claim identifiers only for the authenticated ownership check.
- Pass 115: confirmed legacy list GET filters to PUBLISHED rows.
- Pass 116: confirmed keyset list GET filters to PUBLISHED rows.
- Pass 117: confirmed the list paths sanitize each row through `sanitizePublicDirectoryListing`.
- Pass 118: confirmed the public metadata sanitizer uses a separate allowlist.
- Pass 119: confirmed `contact_email` and owner user identifiers are not in the normal public field selection.
- Pass 120: confirmed public CORS is allow-listed and responses set `Cache-Control: no-store`.

### 121–130 — Contact and location fields
- Pass 121: confirmed `phone` is explicitly selected for published directory listings.
- Pass 122: confirmed `secondary_phone` is explicitly selected.
- Pass 123: confirmed `address` is explicitly selected.
- Pass 124: confirmed governorate, district and village are selected as public locality labels.
- Pass 125: confirmed the row sanitizer preserves the approved public listing keys, including phone and address.
- Pass 126: confirmed metadata is filtered to a fixed set of keys rather than passed through wholesale.
- Pass 127: confirmed `google_maps_url` is currently included in the public metadata allowlist.
- Pass 128: confirmed arbitrary unlisted metadata keys are dropped.
- Pass 129: confirmed the endpoint supports doctor, clinic, pharmacy, medical-center, hospital, laboratory, health-provider and business listing types.
- Pass 130: confirmed this is a separate public directory contract, not either of the two catalog business projection endpoints changed by PR #756.

### 131–140 — Authorization and publication semantics
- Pass 131: confirmed anonymous GET is intentionally supported for PUBLISHED records.
- Pass 132: confirmed slug-detail `can_edit` defaults to false.
- Pass 133: confirmed a bearer token is resolved with Supabase `auth.getUser`.
- Pass 134: confirmed anonymous Auth users do not gain edit access.
- Pass 135: confirmed claimed-user ownership is checked against the authenticated user ID.
- Pass 136: confirmed claimed-business edit access requires an active OWNER/BUSINESS_OWNER membership.
- Pass 137: confirmed `owned_business_id` is returned only when `can_edit` is true.
- Pass 138: confirmed public list routes do not include claim owner identifiers in their explicit selected fields.
- Pass 139: confirmed the public endpoint's publication filter is status-based and distinct from catalog-admin's audited contact-consent flow.
- Pass 140: confirmed the public directory listing projection does not currently expose the two catalog consent flags as part of its public field contract.

### 141–150 — Release boundary and disposition
- Pass 141: confirmed no `public_contact_consent_audit_verified` check exists in `sanitizePublicDirectoryListing`.
- Pass 142: confirmed `phone`, `secondary_phone` and `address` remain public for PUBLISHED directory listings.
- Pass 143: confirmed `google_maps_url` can be exposed through allow-listed metadata when present.
- Pass 144: confirmed this separate listing stream has its own source, claim and publication lifecycle; it must not be silently conflated with merchant catalog profile consent.
- Pass 145: recorded a follow-up requirement to review source republication permission and owner/claim consent semantics for this listing stream.
- Pass 146: did not broaden PR #756 to change the national directory's existing publication contract.
- Pass 147: did not add schema fields, migrations, RLS policies or grants.
- Pass 148: did not modify live Production data or deploy any Edge Function.
- Pass 149: kept the existing public directory UI and its pagination/filter contract unchanged.
- Pass 150: retained `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED`; this review is not a release approval.

## Findings / next actions

1. **Separate privacy follow-up required:** decide whether published national-directory records may expose phone, secondary phone, address and metadata Google Maps URLs based on the current source-permission/publication contract, or whether an explicit owner/claim consent audit is required. Review imported/unclaimed records separately from claimed owner-managed records.
2. Keep PR #756 narrowly scoped to catalog business profiles. Do not add a broad consent flag to the national directory without tracing ingestion, source permission, claim, owner-edit and existing publication flows.
3. Add focused tests for the chosen directory-listing publication rule before changing its public projection.
4. The earlier PR #756 Pages validation failure was an obsolete assertion expecting raw Maps URL projection. The validator was updated to assert that authenticated catalog-admin reads retain private profile values while both public catalog reads use `publicContact.googleMapsUrl`. Exact-head rerun is still in progress at the time of this checkpoint.

## Production boundary
No Production database/schema/data/Auth/RLS/GRANT mutation, Supabase Edge deployment, payment/settlement action, or website cutover was performed.
