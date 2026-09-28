# RC102 — G6 Request & Matching Security Baseline

## Scope
Customer request → provider visibility → provider bid/proposal → controlled selection/execution.

## Existing request engines
The production schema already contains:
- `indrive_requests`
- `indrive_bids`
- `marketing_leads`
- `marketing_projects`
- `orders`

The existing RLS policies use owner/provider-specific checks and private helper functions for the reverse-bidding flow.

## G6 security finding
Several tables had generic authenticated `ALL` policies in addition to scoped policies. PostgreSQL RLS permissive policies can combine for the same command, so these generic policies unnecessarily widened the effective access boundary.

Removed from:
- `indrive_requests`
- `indrive_bids`
- `marketing_leads`
- `marketing_projects`

The scoped policies remain.

## Verified resulting boundaries
### Reverse-bidding request
- request insert requires `owner_user_id = auth.uid()` and OPEN_FOR_BIDS.
- request reads go through `private.can_read_indrive_request`.
- request updates/deletes are owner/platform-admin scoped.

### Provider bid
- bid insert requires `provider_user_id = auth.uid()`, OFFERED status, and `private.can_submit_indrive_bid`.
- bid reads/updates use `private.can_read_indrive_bid`.
- delete is provider/platform-admin scoped.

### Marketing lead
- create is requester-owned.
- read is requester-owned.
- no generic authenticated write policy remains.

### Marketing project
- client visibility is membership-scoped to the client business.
- no generic authenticated write policy remains.

## Important integration rule
G6 reuses the existing request/bid/order architecture. It does not create a parallel matching engine.

## Verification
Production DB policy list was re-read after migration and confirmed that only the scoped policies remain on the four reviewed tables.

## Not yet verified
- Two real users/browser E2E for customer request → provider bid → selection.
- Cross-provider and cross-request isolation E2E.
- Conversion from selected bid/request into an order where applicable.
- Notification/push delivery E2E.
- Full production release gate.

## Release status
**G6 security hardening + production DB verification completed.**
**G6 functional E2E remains NOT VERIFIED.**

## Commits
- `789ca063916e904ba17dc3b76197c16b70534853` — RLS hardening migration
