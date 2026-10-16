# Mantyx — Parallel Demo Workspace

**Purpose:** isolated UI prototype for reviewing Mantiqatix workflows before selecting changes for integration.

## Safety contract
- This is a **demo-only** static frontend. It has no Supabase client, production endpoint, API key, payment provider, real SMS/email/push delivery, or write access.
- All sample names, addresses, amounts, orders, metrics, users, and statuses are synthetic and must not be treated as live data.
- Never copy production customer records, provider credentials, access tokens, payment records, or secrets into this directory.
- Do not enable GitHub Pages for this branch or merge this prototype into the production website without explicit review.
- The existing MantiqatiX official public branding and production application remain unchanged. “Mantyx” is a temporary internal demo label only.

## Preview
Open `index.html` in a browser or serve this folder using any static HTTP server. No build step or external runtime dependency is required; Google Fonts is optional and the page falls back to system fonts.

## Included demo areas
Dashboard, orders, customers/CRM, service providers, sector/service catalog, SMM campaigns, finance/wallets, inventory/purchasing, content, analytics, tasks, notifications, users/roles, security/audit, monitoring/backup, and settings.

## Integration method
1. Review workflows and visual behavior with stakeholders.
2. Map each accepted screen to the current MantiqatiX source and authoritative database contract.
3. Implement the selected changes in a separate feature branch.
4. Add unit/contract tests and isolated database/E2E tests for the affected flows.
5. Review security, tenant scoping, pricing, idempotency, auditability, and migration impact.
6. Merge only accepted changes through a reviewed pull request. The demo itself is not a substitute for backend implementation or production release evidence.

## Known limitations
- No real authentication or authorization; role names are display examples.
- No persistent storage; demo-created items last only in page memory.
- Tables and charts contain synthetic sample values.
- Financial entries are illustrations only and cannot move money.
- Backup/monitoring cards describe review gates; they do not inspect real infrastructure.
