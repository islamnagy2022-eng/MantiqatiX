# R6 Unit Test, Telemetry and Performance Evidence Review
Date: 2026-11-08

## Executive result

The original R6 archive contains 12 unit-test files. The available test run passed **78/78**. This is a useful source-level result, but it does not establish production integration, API authorization, Supabase RLS, payment safety, disaster recovery, browser readiness or real load capacity.

Several tests exercise deterministic business-rule helpers, local in-memory objects or simulated metrics. Those tests must not be presented as evidence that corresponding production infrastructure has been deployed or independently exercised.

## 1. What the 12 test files cover

| Test file | Source coverage | What the tests establish | What they do not establish |
|---|---|---|---|
| `aiPixelCommissionEngine.test.ts` | Deferred commission calculations, Meta Pixel event object shaping, preference/AI engine | Helper outputs and business-rule calculations | Actual Meta event delivery, ad attribution truth, AI service availability, budget enforcement or Android push delivery |
| `billingEngine.test.ts` | Paymob HMAC helper, subscription-cycle decisions, wallet auto-renew helper | HMAC helper rejects altered data; local renewal/billing calculations | Secure Express webhook route, real provider callback, server identity/ownership, idempotency under concurrency, ledger persistence or real payment |
| `bookingPaymentEngine.test.ts` | Promotions, booking totals, receipt formatting | Local calculation and WhatsApp/reference formatting | Persisted bookings, slot locking, race prevention, secure deposit collection/refunds or provider settlement |
| `enterprise.test.ts` | Arabic normalization, Haversine calculation, ranking, load simulation | String/distance algorithms and simulated-output shape | Real search service performance, real geospatial accuracy, load-generator performance or infrastructure scale |
| `geoCoordinates.test.ts` | Markaz/governorate coordinate fallback and offset | The helper deterministically generates map coordinates from known area centers | Exact activity GPS coordinates or accurate nearest-business ranking when a business has no verified coordinates |
| `mantygoBiddingEngine.test.ts` | Eligibility and negotiation helpers | Local bidding/negotiation state transitions | Authenticated multi-tenant API, cross-business denial, persistent bids, transaction concurrency or customer/provider identity |
| `merchantIndispensableSuite.test.ts` | Ledger-summary, loyalty, retention, QR and B2B helpers | Arithmetic/formatting and local rules | Authoritative accounting ledger, journal immutability, financial reconciliation, delivery or procurement operations |
| `merchantNotificationEngine.test.ts` | Notification normalization and WhatsApp URL formatting | Message payload and URL formatting | Actual dispatch, provider delivery status, opt-in/consent, abuse limits or webhook authenticity |
| `productionEnterpriseEngine.test.ts` | Media helper, WhatsApp dispatch record, token helper, backup record and local readiness evaluator | Utility behavior over supplied objects | Actual Auth, route authorization, key custody, real backup encryption/restore, independent scanner, live database status or production readiness |
| `rules.test.ts` | Local tenant/business filtering, subscriber helper, cart, package and wallet functions, seed fixtures | Pure function behavior and fixture invariants | Supabase RLS, Edge Function authorization, HTTP IDOR prevention, server-side enforcement or whether fixture businesses are real/verified in production |
| `sector5StagesEngine.test.ts` | Stage and plan mapping | Local sector-plan mapping | Enabled live sector workflows, entitlements enforced by server or paid feature activation |
| `subCategoriesTaxonomy.test.ts` | Taxonomy lookups and Arabic matching | Local taxonomy lookup/matching | Consistency with canonical live MantiqaTix activity/specialty codes or persisted taxonomy governance |

## 2. Critical misleading-evidence risks

### 2.1 Load test is a mathematical simulation, not an executed load test

File: `src/utils/loadTestingEngine.ts`

- `simulateEnterpriseLoadTest(vus)` selects hard-coded ranges of RPS, latency and error rate based on the requested VU number.
- It uses `Math.random()` to generate sample figures.
- It does not create virtual users, connect to HTTP endpoints, exercise a database, send search queries, execute checkout or measure a cloud deployment.
- `enterprise.test.ts` calls `simulateEnterpriseLoadTest(500000)` and checks that the returned numbers have plausible values. This verifies the simulation function, not 500,000 concurrent users.
- `getLiveTelemetryMetrics()` also generates CPU, memory, connections, RPS, latency, cache ratio and pod counts from formulas and random numbers. Its return is not connected to a live monitoring provider in the source reviewed.

**Required action:** rename/label these values as DEMO/SIMULATED and never show them as live telemetry or measured load results. Replace them with real metrics sourced from the production monitoring stack. Real load tests require checked-in k6/Locust scripts, fixed workload definitions, an identified environment, run IDs, raw output and repeatable execution.

### 2.2 Readiness test asserts completion from a mock object

File: `src/utils/productionEnterpriseEngine.test.ts`

The test constructs a mock database object from `INITIAL_BUSINESSES`, `INITIAL_PRODUCTS`, `INITIAL_SUBSCRIBERS`, a generated audit record and a generated backup record. It then expects `evaluateAllProductionPhasesStatus()` to return 100% readiness and all phases completed.

This proves that a local evaluator returns a result for the supplied object. It does not prove that Supabase Production, Auth, RLS, payment, backups, Edge Functions, monitoring, or any deployment gate has passed.

**Required action:** do not use this helper to certify release readiness. Production gate status must be assembled from independently verified CI, live service, database, security, backup/restore and deployment evidence.

### 2.3 Local tenant-isolation tests are not RLS or API isolation tests

File: `src/utils/rules.test.ts`

The test named `Tenant isolation: subscriber cannot access another business` tests an application helper on local objects. This is useful but insufficient against a direct HTTP request, modified businessId, forged role, stale membership, another tenant's UUID, branch mismatch or direct Data API call.

**Required action:** add disposable PostgreSQL/Supabase integration tests for authenticated and anonymous actors across multiple tenants, businesses and branches. Include negative tests against every privileged Edge action and table policy.

### 2.4 The Paymob helper test does not cover the R6 webhook route

Files:
- `src/utils/billingEngine.test.ts`
- `server.ts` route `POST /api/payments/paymob/webhook`

The unit test verifies the helper's HMAC generation/verification behavior. The actual server route chooses `hmacSignature || targetIntent.hmacSignature`. When the request omits its signature, the route can fall back to a signature stored with the local intent. The helper test never invokes this route, so it does not catch this route-level trust-boundary flaw.

**Required action:** do not import the current route. Implement the provider callback contract on a server-side adapter, reject missing/invalid signatures, bind amount/currency/intent/merchant, enforce idempotency and test the actual HTTP/Edge route with authentic/tampered/omitted/duplicate callbacks.

### 2.5 Coordinate fallback is approximate

File: `src/utils/geoCoordinates.ts`

- Explicit coordinates on a business are returned when within the coded Egypt bounds.
- Otherwise the function resolves a known markaz/city center, then a governorate center, then an Egypt default.
- It applies a deterministic offset of up to approximately 700 meters so businesses do not overlap on a map.

Thus the function's "accurate GPS" comment overstates its fallback. The returned values can be synthetic map-pin offsets, not the business's actual GPS location.

**Required action:** distinguish `EXACT_OWNER_PIN`, `MARKAZ_APPROXIMATION`, `GOVERNORATE_APPROXIMATION` and `UNKNOWN` in the domain model. Do not claim exact distance or nearest-business ordering from synthetic coordinates. Obtain a verified location with consent before enabling exact proximity claims.

## 3. Missing high-value test layers

The 78 unit tests do not contain evidence of the following layers:

- **HTTP/API security:** direct unauthenticated access, forged request role, replay, cross-tenant IDOR, branch escape, mass assignment and backup access denial.
- **Supabase:** live-schema contract tests, RLS/GRANT tests, Edge Function integration, Auth session refresh/revocation, membership changes and deployed function-version parity.
- **Financial correctness:** concurrent duplicate webhook delivery, idempotency key reuse, ledger invariants, refund/reversal, currency mismatch, fee rounding and reconciliation.
- **Persistence:** migration replay from an approved baseline, rollback/recovery and concurrent writes against a disposable database.
- **Browser E2E:** sign-in, public directory, merchant flows, admin workflows, errors/empty states, deep links and real backend interactions.
- **Accessibility and mobile:** keyboard/screen-reader journeys, Arabic RTL layout, small viewport, install/update/offline PWA lifecycle and device regressions.
- **Operations:** measured load test, real telemetry, backups restore, DR failover and alert delivery.

## 4. Acceptance criteria for R6 test closure

1. Preserve the 78 current unit tests and run them in repeatable CI using the committed lockfile and supported test command.
2. Mark all simulation outputs as simulated or remove them from live dashboards until a real provider is connected.
3. Replace the readiness evaluator with a gate aggregator that accepts only independently verified evidence and reports missing evidence as `NOT VERIFIED`.
4. Add adapter contract tests for public directory and catalogue field visibility, branch-specific prices, hidden prices and verified-provider display.
5. Add real Auth/RLS/Edge integration tests for tenant/business/branch isolation and negative permission cases.
6. Add adversarial payment webhook tests against the actual server implementation, including missing, malformed, duplicate and tampered callbacks.
7. Add browser E2E/accessibility/mobile/PWA tests and run them on an exact release commit.
8. Execute load and recovery exercises in identified controlled environments and retain run metadata, logs and raw outputs.

## Final status

- Current R6 unit tests: **78/78 PASS**.
- Test suite as evidence of utility/helper behavior: **PASS**.
- Test suite as proof of production security, integration or 100M performance: **NOT SUFFICIENT**.
- Simulated load telemetry currently presented as live/measured: **MUST BE LABELED OR REPLACED**.
- Supabase/RLS/API integration tests: **NOT VERIFIED**.
- Browser E2E/accessibility/PWA/device tests: **NOT VERIFIED**.
- Production release: **BLOCKED / NOT CERTIFIED**.


## Additional P0: default administrator credential

Static source review found:
- `src/data/seedData.ts` initializes `AdminSettings.adminPassword` to the literal `admin`.
- `src/context/AppContext.tsx` grants the local `admin` role and switches to `super_admin` view when `loginAsAdmin()` receives the in-memory password.
- `src/components/Navbar.tsx`, `src/components/auth/LoginModal.tsx` and `src/App.tsx` include shortcut calls to `loginAsAdmin('admin')`.

This confirms administrator mode in the R6 UI is a client-side demo switch, not real protected authentication. It is a P0 import blocker. Remove all default credentials/shortcut paths and derive platform authority only from Supabase Auth and exact server-verified active platform membership, with server enforcement on every operation. Updated cleanroom package SHA-256: `287fb76b69ede0721f808ce8813551e7a2d5d79b9eb0e70f0df95eed849d3bef`.
