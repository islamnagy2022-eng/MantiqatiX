# V6 r5 visual-parity gap register — 2026-11-06

## Decision

The AI Studio V6 r5 archive remains the canonical design/source reference. The current `/v6-preview/` is a validated **public directory slice**, not a full visual or functional reproduction of r5. Do not mark AI Studio r5 parity complete.

Canonical archive:
- `MantiqaTix-AI-Studio-V6-CANONICAL-CANDIDATE-2026-11-05-r5.zip`
- SHA-256: `0e868efefbacd5cf3ec4c07a558230ce5cdfbbbdab64416182bc9a59f3acd429`
- ZIP integrity previously verified PASS.

## Evidence of the difference

Original r5 reference captures inside the canonical archive:
- `screenshot_homepage.png` (1280×720): full brand/navigation header, homepage hero, primary calls to action and wide cover/hero image.
- `screenshot_marquee_and_ads.png` (1280×720): sector tiles/plans area and a vertical sponsored-ad column.
- `screenshot_marquee_strips_close.png`: product/service marquee-strip treatment.
- `merchant_dashboard.png`, `merchant_location_tab.png`, `merchant_location_fields.png`: authenticated business workspace reference screens.

Current tested public Preview:
- `v6-desktop-directory.png`
- `v6-desktop-activity-profile.png`
- `v6-mobile-directory.png`
- `v6-mobile-activity-profile.png`

Current Preview successfully covers the public directory, activity-to-specialty filtering, verified-first order, red unverified status dot, 20+5 progressive pagination, public activity profile, read-only products/prices, phone/WhatsApp contact, mobile responsiveness and accessibility.

The Preview source README explicitly narrows its public scope and omits these r5 public-homepage elements:
- Complete r5 homepage hero/cover and its original home navigation composition.
- The full 15-sector / three-tier development-plan section and the interactive governorate map.
- Product/service marquee strips.
- The vertical sponsored/regional advertising column and related public promotion modules.

These omissions are deliberate in the current public MVP slice; they are not proven defects in the production catalog. They are also not accepted as final AI Studio parity.

## Safe implementation order

1. **Public home shell:** restore the r5 hero, brand/navigation hierarchy, main calls to action and 15-sector navigation using the canonical archive as visual reference. Keep the currently tested directory route reachable and preserve direct activity/specialty URLs.
2. **Sector discovery:** reintroduce sector cards, three-tier plan previews and interactive governorate map only where data and route behavior are real and verified. Do not invent activity counts or registration metrics.
3. **Marquee strips:** source cards only from currently published, available products/services and active price rows. Never use seed-generated/fabricated product popularity or sales numbers.
4. **Sponsored placements:** render only records returned by the approved active/approved ads contract within its targeting, time-window, cap and consent rules. No hard-coded ad assets or fabricated advertiser claims.
5. **Authenticated workspaces:** evaluate merchant/admin dashboards separately. Require server-verified Auth session, membership, business scope and permission; no localStorage/seed fallback and no client-side privilege inference.
6. **Wallet, cart, checkout, orders and messaging:** keep out of the public Preview until the coupled production finance/payment/Edge contracts, idempotency, wallet ledger and authorization gates are independently certified.

## Acceptance criteria

- Side-by-side screenshots at matching desktop (1280×720) and mobile (390×844) sizes against the canonical r5 captures, with every intentional difference documented.
- Browser E2E for home navigation, sector selection, governorate map/search, product/service strips and advertisement rules.
- Confirm no fake metrics, seed products, unapproved ads, private admin/wallet/checkout code in public JS, or cross-tenant information leaks.
- Preserve the current directory E2E contract: 20 initial activities + «رؤية المزيد», activity → specialty, verified-first, red unverified dot, no horizontal overflow, and axe critical=0.
- Keep the current catalog at Pages root until explicit release approval. V6 remains isolated at `/MantiqaTix/v6-preview/` until parity and release gates pass.

## Release boundary

This register is a development acceptance gap, not deployment approval. No Production schema/data/Auth/RLS/GRANT/Edge/payment/finance mutation is authorized. `FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED` remains.


## Implemented and independently validated — 2026-11-07

- Public homepage cover restored as a three-slide public carousel with three CTAs; browser assertions cover slide navigation and the CTA presence.
- Added a live published catalog strip using only the public directory adapter's product rows, verified business ownership, availability and finite recorded prices. The strip exposes the owning activity route, with no fabricated ranking/popularity/order metrics and no cart/checkout/payment action.
- Exact PR head `8a96b1cb00011892c6b03e0fdda8686ed27ea820`: 9/9 workflows PASS. V6 desktop/mobile browser E2E, directory pagination/search/specialty/profile and axe (critical=0/non-critical=0) PASS. Primary Catalog browser E2E (32 journeys), isolated migration-chain replay and all specialist workflow checks PASS.
- Pages composition PASS; deploy skipped on PR event. No deployment occurred.

## Remaining r5 parity work

1. Canonical 15-sector card grid + quick-tabs mode and the three-tier sector spotlight/studio navigation; use the canonical taxonomy and real live activity counts only.
2. Governorate map/filter; only use exact source-backed business coordinates or explicitly labeled administrative aggregates. Do not restore approximate/jittered/default map pins.
3. Approved targeted-ad column; only active/approved ad records inside the targeting/time/cap/consent contract.
4. Paired desktop/mobile screenshot comparison against the r5 references.

The exact-head CI closeout is not visual parity certification. FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED remains; no merge-to-main, deployment, root cutover, or Production mutation is claimed.

## Implemented and validated — 2026-11-07 — public governorate explorer

- Added a public governorate explorer using the actual public directory business list for activity counts.
- Map markers use only the maintained governorate reference centers in `EGYPT_GOVERNORATES_MAP`. They are aggregate administrative reference points, not individual business locations. The interface states this explicitly.
- Selecting a governorate from the list or map updates the existing directory governorate filter; reset returns to all governorates. Unrecognized governorate labels remain filterable in the list but receive no invented map point.
- The map implementation does not call `resolveBusinessCoordinates`, does not use jitter/default fallbacks for business pins, and does not read private dashboard state.
- Browser acceptance on exact code head `d457d23450701b43aae98a096a9bacc0328be078`: four fixture governorates rendered; selecting Monufia updated the filter; reset restored all governorates; `V6_PUBLIC_GOVERNORATE_MAP=PASS mapped_governorates=4 business_pins=false`.
- Exact-head PR validation: 10/10 workflows PASS. Pages composition and desktop/mobile V6 browser E2E PASS; accessibility audit critical=0/non-critical=0. Primary Catalog build, employee/RBAC PostgreSQL and 32 browser journeys PASS. Forward migration chain replay PASS on the isolated schema-only checkpoint; this is not a true Production data/Storage/Auth restore.
- No deployment occurred: Pages deploy remains skipped for the PR event. The site has not yet been updated with this commit.

## Remaining r5 parity work

1. Complete r5 brand/navigation header parity and the remaining homepage composition.
2. Reconcile the 15-sector/three-tier showcase with the approved public taxonomy: keep directory discovery as activity → specialty; display only real activity counts and do not introduce an additional functional-group taxonomy layer.
3. Render the approved targeted-ad column only from active, approved ad records honoring target, time-window, cap and consent rules.
4. Compare paired desktop/mobile screenshots at the reference sizes, including a live tile-loaded map and the complete homepage.

The exact-head CI closeout is not visual parity certification. FULL_PLATFORM_GATE=BLOCKED / NOT CERTIFIED remains; no merge-to-main, deployment, root cutover, or Production mutation is claimed.


## Implemented and validated — 2026-11-07 — public r5 brand/navigation shell

- Rebuilt the V6 public navbar as a responsive, r5-aligned shell: slim dark platform context strip, clear MantiqatiX wordmark and MX mark, concise public-directory descriptor, and distinct public navigation row.
- Public navigation exposes only the routes actually present in the isolated public app: directory, medical directory and contact. The brand control returns to the public directory; active navigation state also remains correct while viewing a public business storefront.
- Guest login and authenticated logout are retained. The public header does not expose merchant/admin dashboard routes, wallet, cart, checkout, internal inbox or unverified privileged controls from the monolithic r5 source.
- Playwright assertions added for exactly three public destinations, active aria-current state across the directory/medical/contact views, and brand-home return. Browser result: `V6_PUBLIC_R5_NAVIGATION=PASS destinations=3 brand_home=true`.
- Exact code head: `19b8b9ebabd118ca005071dd3df56802011d54a3`. Exact-head PR workflows: **10/10 PASS**, including Pages desktop/mobile Preview browser E2E, Pages composition, Primary Catalog build + 32 browser journeys + employee/RBAC PostgreSQL, isolated 76-migration forward replay and specialist contract/security workflows.
- Desktop/mobile visual review artifacts generated from browser fixtures. Mobile header was inspected at 390px width; wordmark and all three public navigation destinations remain legible and reachable. Test content is synthetic, not production business data.
- Pages workflow validation/composition succeeded; deploy was skipped on the PR event. No production root change, merge, Supabase write or live function deployment.

## Remaining intentional parity/release gaps

- Do not reintroduce the original r5 mega-navigation wholesale: several original links point to merchant/admin, wallet, cart, messages, paid advertising and subscription flows that remain outside the public-only certified boundary.
- Do not add an intermediate "functional groups/fields" taxonomy layer or fabricate a 15-sector catalogue. Public discovery remains activity → specialty; the dynamic activity card grid and horizontal quick-tabs provide the supported route into the catalogue. Any subscription/three-tier plan display must be backed by real published plan records and a verified plan contract.
- The public sponsored-ad column remains deferred until a read-only public ads contract proves active/approved status, placement scope, campaign dates, audience targeting, frequency caps, privacy/consent, and tenant isolation. The original r5 rotating/default promo component is not safe to expose as-is.
- Full visual parity is not certified. Pairwise desktop/mobile comparison against all original r5 reference captures remains open, alongside production schema/RPC/Edge/Auth/RLS/finance and true backup/restore blockers.


## 2026-11-08 — Post-cutover implementation reconciliation

The V6 public-root cutover is complete on `main`; this supersedes the earlier statements in this register that no deployment/root cutover had occurred.

- Public r5 cover: three-slide cover and public CTAs are included in the deployed source and the V6 browser test.
- Activity discovery: the 15-sector discovery grid and cards/quick-tabs view modes are present; the public route remains activity → specialty. Do not add a competing functional-group/plan taxonomy.
- Geographic discovery: the public governorate explorer/filter is present. Map markers are administrative reference points only; no business pins or inferred coordinates are used.
- Public published catalog: the live strip uses published, available product records, verified activity ownership and recorded visible prices; it does not fabricate popularity or sales.
- Sponsored placements: the public rail now calls the existing read-only `get_mnty_targeted_advertisements` RPC for `HOME_SPONSORED`. Pages CI verifies CORS and sanitized active-ad output; browser E2E uses synthetic fixture rows to verify placement filtering, safe HTTPS links and creative rendering. The synthetic fixture count is not a claim about live inventory or campaign performance.
- Root, `/legacy/`, and `/v6-preview/` were deployed and verified by Pages run [42502614593](https://github.com/islamnagy2022-eng/MantiqatiX/actions/runs/42502614593). Deployed-origin browser checks cover legacy QR parameters, root mobile width and legacy dashboard/mobile routes.

### Remaining intentional gaps and release boundaries

1. **Three-tier plans/sector subscription narrative:** not public. The uploaded R6 blueprint's static tier prices/caps are not authoritative; production pricing is not anonymously readable. No public plan endpoint or subscription activation flow is certified.
2. **Authenticated workspaces:** the public V6 shell does not expose merchant/admin/wallet/checkout routes. Keep the retained legacy workspace available while its contracts are ported into V6 with server-verified identity, membership, tenant/business/branch scope and permissions.
3. **R6 archive integration:** UI reference only. Do not publish its Express/local-JSON state model, localStorage authority, seeded roles/credentials, or hard-coded secret fallbacks.
4. **Visual parity:** complete paired screenshot review against the original r5 captures; browser fixture success alone is not visual approval.
5. **Full platform release:** schema/ledger reconciliation, live Edge source parity, Auth hardening, least-privilege/RLS/ACL negative tests, coupled finance/payment tests, genuine data/Storage/Auth backup restoration, measured RPO/RTO and rollback remain separate blockers.

