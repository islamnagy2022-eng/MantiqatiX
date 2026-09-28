# RC176 — Used Items Module Activation

- Activated the existing used-items sale-state workflow.
- Sellers can mark their own existing advertisement as sold or re-available.
- The update is owner-scoped in the client query and remains subject to database RLS.
- No buyer/payment/chat/escrow workflow was invented because no verified transaction or messaging contract was found in the current table model.
- No synthetic records were created.
- OPEN: browser E2E, owner isolation, buyer contact workflow, payment/commission, image/storage validation, CI and release gate.
