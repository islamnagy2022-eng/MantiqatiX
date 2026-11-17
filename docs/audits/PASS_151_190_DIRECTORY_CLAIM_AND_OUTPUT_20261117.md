# Pass 151–190 — Directory claim, owner-edit and public-output review
Date: 2026-11-17
Scope: source-level review and narrowly scoped fixes on the current-main PR #756 branch.

## Pass register

### 151–160 — Claim request lifecycle
- Pass 151: verified claim submission requires a non-anonymous authenticated user.
- Pass 152: verified contact name is normalized and falls back to Auth profile/email only when omitted.
- Pass 153: verified contact phone requires at least seven digits.
- Pass 154: verified only PUBLISHED directory listings can be claimed.
- Pass 155: verified already-CLAIMED listings are rejected with a conflict.
- Pass 156: verified an existing PENDING/REVIEWING request by the same user is returned idempotently.
- Pass 157: verified new requests require UNCLAIMED state.
- Pass 158: verified claim records store contact name, phone, email, evidence note and PENDING status.
- Pass 159: verified listing claim state is changed with a compare-and-set predicate on UNCLAIMED.
- Pass 160: verified a losing concurrent claim attempt attempts to delete its newly inserted request and returns a conflict.

### 161–170 — Owner-only editing
- Pass 161: verified owner edit requires a PUBLISHED and CLAIMED listing.
- Pass 162: verified authorization accepts the exact claimed user or an ACTIVE OWNER/BUSINESS_OWNER membership on the claimed business.
- Pass 163: verified non-owners receive 403.
- Pass 164: verified the edit requires a non-empty display name.
- Pass 165: verified editable metadata is restricted to bio, working hours, website, booking, services, social links and profile image.
- Pass 166: verified metadata updates merge with the current metadata object rather than replacing unrelated fields.
- Pass 167: verified owner updates can change the contact phone, secondary phone and address.
- Pass 168: identified that omitted governorate/district/village values previously defaulted to Monufia / Berket El Sabaa, risking silent relocation for partial API clients.
- Pass 169: fixed owner edits to load and preserve the saved governorate, district and village when omitted.
- Pass 170: added source-contract assertions preventing a regression to the hard-coded location fallback.

### 171–180 — Source permission and administrator controls
- Pass 171: verified all post-claim administrative actions require a global platform-admin membership.
- Pass 172: verified source evidence registration requires explicit doctor-profile republication and commercial-republication scope.
- Pass 173: verified evidence references are constrained to internal private:// or contract: references, not public URLs.
- Pass 174: verified source evidence begins in PENDING state.
- Pass 175: verified the evidence creator cannot approve their own evidence.
- Pass 176: verified approval rejects future-dated, expired or out-of-scope evidence.
- Pass 177: verified approval uses a PENDING-state compare-and-set.
- Pass 178: verified revocation requires a reason and only changes PENDING/APPROVED evidence.
- Pass 179: verified admin listing and claim bundles are behind the platform-admin gate.
- Pass 180: identified a separate workflow-hardening requirement: claim approval performs several membership/listing/request writes without a single database transaction; rejection also does not currently surface failure from the listing-state reset. Keep this as a tracked reliability issue rather than attempting a partial transaction fix in this pass.

### 181–190 — Import and public output
- Pass 181: verified doctor imports are capped at 20 rows per batch.
- Pass 182: verified rows are processed sequentially.
- Pass 183: verified duplicate matching checks both incoming phone fields against stored primary and secondary numbers.
- Pass 184: verified fallback identity matching uses display name plus governorate and district.
- Pass 185: verified partial imports preserve existing phone values, slug, source attribution, source-check date and claim state.
- Pass 186: verified imported records are marked unverified and require owner confirmation; import cannot directly publish a requested PUBLISHED row.
- Pass 187: verified new/changed-source doctor publication requires current approved source permission evidence.
- Pass 188: verified public listing serialization uses explicit top-level and metadata allowlists.
- Pass 189: fixed public `google_maps_url` metadata so only HTTPS Google Maps destinations on the approved host list are exposed; unsafe schemes, hosts, credentials, ports and non-Maps Google paths are dropped.
- Pass 190: added behavior tests for valid Google Maps URLs and unsafe URL rejection, plus static regression checks for the owner-location preservation rule.

## Changes made
1. `supabase/functions/directory-listings/index.ts`: owner partial edits now preserve stored governorate/district/village instead of defaulting omitted fields to a specific Egyptian location.
2. `supabase/functions/directory-listings/public-directory-output-contract.mjs`: dedicated HTTPS Google Maps URL validation for public metadata.
3. `scripts/production/test-public-directory-output-contract.mjs`: positive and negative URL test cases.
4. `scripts/production/validate-doctor-incremental-import.mjs`: regression assertions for owner location preservation and public Maps URL validation.

## Remaining issues
- Claim approval should move to one transactional database operation that atomically validates claim state, creates/activates membership, links the listing, and finalizes the request.
- Claim rejection should atomically update the request and release the listing claim lock; current code ignores the listing reset error.
- Decide and document explicit contact/map disclosure semantics for imported/unclaimed national directory records separately from catalog merchant consent.
- Do not infer professional registration verification from ownership claim or owner profile edits.

## Validation and production boundary
The new changes are source-level only and are covered by the existing doctor-incremental-import workflow. Await exact-head Deno check, Node behavior tests, and CI. No Production Edge Function deployment, database migration/data change, RLS/GRANT/Auth mutation, financial action, or Pages cutover was performed.
