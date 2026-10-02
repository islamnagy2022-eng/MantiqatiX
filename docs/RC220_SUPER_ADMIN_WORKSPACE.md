# RC220 — Super Admin operational workspace

- Adds a dedicated SUPER_ADMIN control surface to the existing web workspace.
- Business creation remains approval-controlled; the UI creates a pending business through business-register, then can approve it through business-approval.
- Branches use the existing business-branch-admin server path.
- Catalog items, prices and settings use the existing catalog-admin server path and SUPER_ADMIN-aware backend RPCs.
- Provider onboarding remains identity-backed: the workspace can approve an existing pending onboarding request but does not fabricate provider identities.
- No service-role key is exposed to the browser.
- This RC does not certify Production Ready; E2E, backup/restore, leaked-password protection, payment and rollback gates remain separate release gates.
