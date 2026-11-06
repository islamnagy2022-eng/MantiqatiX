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
