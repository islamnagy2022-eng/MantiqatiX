# RC157 — Enterprise Module Runtime Baseline

Activated existing domain module workspaces inside web/app.js for:
- Accounting
- ERP
- Factories
- Trips
- Matrimony

The implementation reads existing production contracts and applies current authenticated tenant/user scope before loading operational rows.

Matrimony public listing explicitly excludes direct_contact_phone and wali_contact_phone.

Source commit: 44cb88ade70cc5e17dba2afffef00bac95bd74e0

Not verified:
- browser E2E
- cross-tenant isolation E2E
- workflow mutation/approval/payment E2E
- CI for this commit
- production go-live gate
