# RC158 — ERP Operational Runtime Baseline

Implemented in `web/app.js` using existing production backend RPC contracts:

- `create_purchase_order_backend`
- `update_purchase_order_status_backend`
- `receive_purchase_stock_backend`
- `create_stock_transfer_backend`
- `update_stock_transfer_status_backend`
- `receive_stock_transfer_backend`

The UI does not write directly to backend-only ERP tables. Operations are routed through authenticated RPCs that enforce membership, business scope, role, validation, idempotency and inventory updates.

Source commits:
- RC157 enterprise runtime: 44cb88ade70cc5e17dba2afffef00bac95bd74e0
- RC158 ERP operations: 4665534f750633c06c71d1a3d051521ec636af53

Verification:
- Production RPC existence verified in Supabase.
- Source presence verified on GitHub.
- GitHub workflow run for RC158 was not returned.
- Browser E2E, cross-tenant isolation, real inventory transaction rehearsal and release gate remain NOT VERIFIED.
