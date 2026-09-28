# RC98 — G4 Service Provider Baseline

## Scope
**Service Provider → Registration → Approval → Profile → Services/Catalog → Orders → Status → Notifications/Support**

## Source-derived requirements
The project specification requires a registered service provider to be able to:
- register;
- create a profile;
- identify sector;
- identify services offered;
- define service location/service areas;
- manage availability according to the system;
- receive customer requests according to permissions and workflow;
- follow service execution;
- use location only when operationally necessary;
- manage provider data within its permissions.

Location remains **Minimum Necessary Location** and an **Operational Service Map** concern. Provider location, customer location, and service location are distinct; unverified coordinates must not be treated as verified.

## Existing implementation verified
- Registration allows `SERVICE_PROVIDER` requests only through the controlled registration-request path.
- Registration requests are initially PENDING; operational membership is not granted automatically.
- Administrative review is performed through the server-side registration/approval flow.
- Provider profile ownership is enforced by RLS using `owner_user_id = auth.uid()`.
- Active provider profiles can be publicly discovered.
- Provider profile image upload is owner-scoped and stored under a user/provider-specific path.
- Catalog access is authenticated and tenant/business scoped.
- Order pricing remains server-authoritative.
- Order status changes remain server-authoritative.

## G4 implementation
### Provider order scope correction
A real functional gap was identified:
- `SERVICE_PROVIDER` was not included in the server-side order-status role scope.
- The existing customer-oriented order query also filtered orders by `customer_id`, preventing a provider workspace from receiving its business orders.

Implemented:
1. Added an RLS SELECT policy allowing `SERVICE_PROVIDER` to read orders only where:
   - authenticated/non-anonymous;
   - active membership;
   - same tenant;
   - same `business_id`.
2. Extended `update_order_status_backend` to recognize `SERVICE_PROVIDER` as an operational role only when its active membership business matches the order business.
3. Updated the provider workspace to query business-scoped orders for `SERVICE_PROVIDER` and `BUSINESS_OWNER`.
4. Extended the client-side workflow guard to expose the same provider transitions; server authorization remains authoritative.

## Security boundary
No global provider access was added. The new read path is constrained by:
**user → active membership → tenant → business → order**.

Status mutation still passes through the SECURITY DEFINER RPC with an authenticated-user identity check and business-scope check.

## Verification
### DONE
- Provider source review.
- Registration/RBAC source review.
- Provider profile RLS review.
- Order RLS review.
- Server status-transition review.
- Database migration applied successfully.
- New provider order policy verified in production database.
- Updated status RPC verified in production database.
- GitHub source commits recorded.

### NOT YET VERIFIED
- Real browser E2E with a real SERVICE_PROVIDER account.
- Provider receives a real customer order in browser UI.
- Provider confirms/prepares/delivers a real order through the UI.
- Cross-business isolation E2E.
- Provider service/location management E2E.
- Production push/notification delivery E2E.
- Full production release gate.

## Release gate
G4 is **implemented and database-verified, but not fully E2E verified**.
