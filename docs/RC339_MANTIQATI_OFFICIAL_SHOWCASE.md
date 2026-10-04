# RC339 — Mantiqati Official Showcase

## Status
**IMPLEMENTED — PRODUCTION DATA APPLIED / CI PENDING**

## Scope
The production project now contains an official platform-managed showcase layer named **«منطقتي»**.

### Created
- 25 official showcase sectors/activities.
- 24 platform modules with active master-data records.
- 25 business profiles under `MNTY-PLATFORM`.
- One `OWNER` membership per showcase business, managed by the existing Super Admin account.
- 25 official provider profiles in `marketing_provider_profiles`.
- 25 official primary services and provider-service links.
- All 24 modules enabled for every official showcase business.
- 25 production-safe SVG activity identity icons under `web/assets/activities/`.
- A scoped public RLS policy exposes only active businesses explicitly marked `settings.showcase=true`.
- Homepage integration loads the official showcase from the database and renders responsive activity cards and the module catalog.

## Naming examples
- دكتور منطقتي
- مطعم منطقتي
- محاسب منطقتي
- وظائف منطقتي
- صيانة منطقتي
- تسويق منطقتي
- برمجيات منطقتي
- عقارات منطقتي
- سيارات منطقتي
- and the remaining platform sectors.

## Governance
These are **official platform-managed showcase profiles**, not fabricated independent third-party accounts. They are owned by the existing Super Admin identity and are intended as the canonical demonstration/entry profiles for each sector.

The business activation trigger was respected. Businesses are created inactive, owner membership is established, and activation is then performed through the existing legal activation gate. No trigger was disabled and no consent record was fabricated.

## Security
The public business policy is narrowly scoped to:
- `status = ACTIVE`
- `settings->>'showcase' = 'true'`

Sensitive membership and business-management writes remain protected by the existing RLS and role checks. The browser only reads public showcase data; it does not receive service-role credentials.

## Visual identity
Each activity has its own deterministic SVG icon/logo asset. SVG was chosen for crisp rendering, small payloads, accessibility metadata, and reliable deployment with GitHub Pages.

## Verification still required
- Browser production smoke test of the new homepage cards.
- Super Admin runtime verification that all 25 memberships and profiles appear in the management workspace.
- Full domain-specific transaction E2E remains a separate release gate.
- Real independent provider onboarding remains separate from these official platform-managed showcase profiles.
