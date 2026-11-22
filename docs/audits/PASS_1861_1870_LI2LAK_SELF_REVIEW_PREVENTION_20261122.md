# Pass 1861–1870 — Li2Lak self-review prevention

Date: 2026-11-22  
PR: [#971](https://github.com/islamnagy2022-eng/MantiqaTix/pull/971)  
Branch: `feat/li2lak-verified-business-reviews-rebased-20261122`

## Change

The review submission RPC now rejects a customer actor when they have an active membership for the reviewed business or are recorded as its provider-profile owner. The rejection code is `BUSINESS_REVIEW_SELF_REVIEW_FORBIDDEN`.

## Regression coverage

- Added `owner_user_id` to the disposable provider-profile fixture.
- Added a delivered order owned by the business owner.
- Added a PostgreSQL integration negative case proving that the owner cannot review their own business.
- Added static validator assertions and release manifest entries.

Source-level checks confirm the guard, fixture, integration case, validator and release manifest are aligned. The PostgreSQL 17 integration workflow still must execute successfully on the exact current PR head.

No Production database, Auth, RLS, grants, Storage, Edge, payment, wallet or customer data was modified. No deployment occurred.

**Production status: BLOCKED / NOT CERTIFIED.**
