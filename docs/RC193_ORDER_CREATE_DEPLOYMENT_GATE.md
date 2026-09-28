# RC193 — Order Create Deployment Gate

## Gate result
The RC192 source change exists in GitHub, but the production Edge Function metadata could not be retrieved in this checkpoint. Therefore production convergence is NOT VERIFIED.

## Required before real booking
1. Confirm deployed `order-create` version/source SHA matches RC192.
2. Confirm `verify_jwt` and runtime configuration remain as intended.
3. Perform a real authenticated customer booking against an ACTIVE provider business.
4. Verify the order appears only to the customer and the provider business.
5. Verify provider status transition through the authoritative backend.
6. Verify customer notification creation/delivery.
7. Verify cancellation rules and payment/refund behavior where applicable.

## Release rule
Do not mark the booking path production-ready until these checks are evidenced.
