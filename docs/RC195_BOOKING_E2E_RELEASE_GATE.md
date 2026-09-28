# RC195 — Booking E2E Release Gate

## Purpose
Define the evidence required before the MNTY customer-to-provider booking path can be called production-ready.

## Required evidence
- Customer authentication/session validation.
- Customer authorization to order from an active provider business in another tenant.
- Server-authoritative catalog and pricing.
- Successful order creation through `order-create` and `create_order_backend`.
- Customer sees the created order.
- Only the owning provider business sees the provider-side order.
- Provider status transition through the authoritative backend.
- Customer receives the status notification.
- Cross-customer and cross-provider isolation checks.
- Cancellation behavior, including paid-order protection.
- Payment/refund behavior where enabled.
- CI/build/runtime evidence.
- Production deployment/version evidence.
- Rollback evidence.

## Current gate state
OPEN. No synthetic production order is to be created merely to close the gate.

## Source rule
Follow the project release rule: Implementation is not Verification, and Production Ready requires actual verification across core functionality, Auth/Authz, DB, Security, API, Website/App/Admin, Finance/CRM/Marketing as applicable, regression, backup, monitoring, production configuration, build/signing, external tests, and rollback.
