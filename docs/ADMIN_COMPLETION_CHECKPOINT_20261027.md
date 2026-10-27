# MantiqatiX — Completion checkpoint (2026-10-27)

## Implemented on the fix branch
- Infinite top promotional marquee: 25 unique messages, looped without visible gaps, clipped between the platform title and install button. The install action uses the browser's native PWA prompt when available.
- Google sign-in: normal accounts are provisioned as CUSTOMER automatically where possible. Activity approval is separated from account login.
- Catalog request basket: business and activity details, contact name/phone, location, descriptions and service details are submitted to the server-side review queue; admin can approve/reject and open WhatsApp message drafts.
- Activity hierarchy: new stable taxonomy table and seed migration, «فني تبريد» canonical label, hierarchy-aware public onboarding and admin editing.
- Platform admin: real business listing, owner assignment using verified Google accounts, profile edits, status controls, soft archive/restore, subscription controls, percentage-only commission rules, recent audit metrics, and read-only audit/obligation/reconciliation/commission views.
- Subscriber administration reflects Google OAuth, not password-based account creation.

## Remaining gates
- The JavaScript parse check passed for home.js, app.js, platform-admin-taxonomy.js, platform-admin-businesses.js and platform-admin-finance.js. This is not a production acceptance test.
- Current GitHub Actions runs are queued; no passing build or TypeScript result has been verified yet.
- Taxonomy and onboarding migrations remain drafts and are not applied to production. The new table was absent in the last read-only production schema check.
- The quick-create admin form still starts with the legacy broad category list; hierarchy can be assigned in the edit workflow. Public directory search/autocomplete is not yet completely linked to the new taxonomy.
- Page-visit analytics are not wired. Financial explorers are read-only and do not settle claims or change payout/ledger records. Subscription status changes are explicitly not payment records.
- Authenticated E2E, Deno typecheck, isolated migration replay, RLS/grant review, production migration reconciliation, backup/PITR evidence and a successful restore rehearsal are still required.

## Release safety
PR #411 remains a draft. No production migrations or Edge Function deployments were performed. Do not merge or deploy until all release gates pass.