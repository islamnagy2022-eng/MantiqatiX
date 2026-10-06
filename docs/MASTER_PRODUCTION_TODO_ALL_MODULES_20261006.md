# MantiqatiX — MASTER PRODUCTION TODO / RELEASE CLOSURE
## 2026-10-06

> الهدف: إكمال جميع المديولات وربط Customer ↔ Service Provider ↔ Admin/Operations ↔ Finance، مع اعتبار أي بند غير مثبت بالاختبار **NOT VERIFIED**.

## P0 — بوابة الإطلاق
- [ ] Production Certification.
- [ ] Customer real E2E.
- [ ] Provider real E2E.
- [ ] Admin real E2E.
- [ ] Cross-tenant isolation E2E.
- [ ] Browser production smoke.
- [ ] Android real-device E2E.
- [ ] Payment E2E.
- [ ] Notification E2E.
- [ ] Backup/Restore rehearsal.
- [ ] Rollback rehearsal.
- [ ] Final Security Advisor.
- [ ] CI/CD convergence.

## 1 — Customer Journey
- [ ] Registration/login/session.
- [ ] Profile/contact data.
- [ ] Address/location management.
- [ ] Service/provider discovery.
- [ ] Filters: sector/service/area/rating/availability.
- [ ] Provider profile.
- [ ] Service/package selection.
- [ ] Create service request.
- [ ] Schedule where applicable.
- [ ] Attachments/notes where applicable.
- [ ] Request reference number.
- [ ] Real-time status.
- [ ] Receive provider offers.
- [ ] Compare offers.
- [ ] Accept one offer.
- [ ] Follow execution.
- [ ] Payment.
- [ ] Receipt/invoice.
- [ ] Rating.
- [ ] Reorder.
- [ ] Complaint/dispute.
- [ ] Full history.

## 2 — Provider Journey
- [ ] Registration.
- [ ] Verification/KYC.
- [ ] Business/profile.
- [ ] Sector.
- [ ] Services.
- [ ] Pricing/packages.
- [ ] Service areas.
- [ ] Working hours.
- [ ] Availability.
- [ ] Incoming requests.
- [ ] Accept/reject.
- [ ] Quote/bid where applicable.
- [ ] Appointment.
- [ ] Start/complete service.
- [ ] Completion evidence.
- [ ] Earnings.
- [ ] Commission breakdown.
- [ ] Settlement request.
- [ ] Statement.
- [ ] Customer rating.
- [ ] Disputes.
- [ ] Suspension/appeal.

## 3 — Admin / Operations
- [ ] Unified dashboard.
- [ ] Customers.
- [ ] Providers.
- [ ] Captains.
- [ ] Sectors/services.
- [ ] Orders/requests.
- [ ] Active operations.
- [ ] Payments/refunds.
- [ ] Commissions.
- [ ] Settlements.
- [ ] Disputes.
- [ ] SLA.
- [ ] Notifications.
- [ ] Audit.
- [ ] Governance.
- [ ] Feature flags.
- [ ] Manual intervention with audit.
- [ ] Export/reporting.

## 4 — Finance & Accounting
- [ ] Unified financial transaction contract.
- [ ] Gross amount.
- [ ] Platform commission.
- [ ] Provider net.
- [ ] Sector commission rules.
- [ ] Service commission rules.
- [ ] Provider-specific commission.
- [ ] Fixed/percentage commission.
- [ ] Effective dates/versioning.
- [ ] Historical immutability.
- [ ] Taxes/VAT if approved.
- [ ] Refund.
- [ ] Reversal.
- [ ] Settlement.
- [ ] Reconciliation.
- [ ] Customer statement.
- [ ] Provider statement.
- [ ] Platform statement.
- [ ] Financial reports.
- [ ] Audit.

## 5 — Commission Engine
- [ ] Default platform rate.
- [ ] Per-sector rate.
- [ ] Per-service rate.
- [ ] Per-provider override.
- [ ] Package/plan commission.
- [ ] Fixed fee.
- [ ] Percentage fee.
- [ ] Minimum/maximum fee where approved.
- [ ] Versioned policy.
- [ ] Lock policy into transaction.
- [ ] Prevent historical recalculation.
- [ ] Commission reporting.
- [ ] Settlement integration.

## 6 — Unified Orders / Service Requests
- [ ] Request/order type.
- [ ] Customer.
- [ ] Provider/business/tenant.
- [ ] Service.
- [ ] Location.
- [ ] Schedule.
- [ ] Price.
- [ ] Commission.
- [ ] Payment.
- [ ] State machine.
- [ ] Cancellation reason.
- [ ] Completion evidence.
- [ ] Rating.
- [ ] Dispute.
- [ ] Audit.
- [ ] Idempotency.
- [ ] Notifications.
- [ ] Do not duplicate existing valid contracts.

## 7 — MantiGO
### Customer
- [x] Ride creation/idempotency.
- [x] Pickup coordinates when available.
- [x] Bid reception/comparison.
- [x] Single bid acceptance.
- [x] Trip timeline baseline.
- [x] Cash/payment gate.
- [x] Rating immutability.
- [ ] Map pickup.
- [ ] Map destination.
- [ ] Destination coordinates.
- [ ] Distance.
- [ ] Duration.
- [ ] ETA.
- [ ] Passenger count.
- [ ] Automated/configurable pricing.
- [ ] Live tracking.
- [ ] Receipt/invoice.
- [ ] Dispute/refund.

### Captain
- [x] Onboarding/approval.
- [x] Availability.
- [x] Bid.
- [x] Trip state controls.
- [ ] Navigation.
- [ ] Live trip map.
- [ ] Earnings dashboard.
- [ ] Commission view.
- [ ] Settlement request.
- [ ] Customer rating.

### Matching
- [x] Availability/verification/category baseline.
- [ ] Service area.
- [ ] Real distance.
- [ ] ETA.
- [ ] Reliability score.
- [ ] Scheduled rides.
- [ ] Priority/premium rules.

### Operations
- [x] Expiration RPC.
- [ ] Verified scheduler/worker.
- [ ] Cancellation fees.
- [ ] No-show financial policy.
- [ ] Refund policy.
- [ ] Dispute flow.
- [ ] Operations dashboard.
- [ ] Abuse/rate limiting.
- [ ] Reconciliation.

## 8 — Marketing & Advertising
- [ ] Marketing provider marketplace.
- [ ] Campaigns.
- [ ] Campaign approval.
- [ ] Content calendar.
- [ ] Creative requests.
- [ ] Leads/pipeline.
- [ ] Budgets.
- [ ] Advertising packages.
- [ ] Ad inventory.
- [ ] Sponsored placements.
- [ ] Campaign analytics.
- [ ] Provider/platform commissions.
- [ ] Advertiser invoices.
- [ ] Anti-fraud.
- [ ] Consent/audit.

## 9 — CRM
- [ ] Customer lifecycle.
- [ ] Provider onboarding lifecycle.
- [ ] Interaction timeline.
- [ ] Tasks/follow-ups.
- [ ] Segmentation.
- [ ] Conversion.
- [ ] Retention.
- [ ] Re-engagement.
- [ ] Provider performance/churn.
- [ ] Support history.

## 10 — Sectors
For every sector define and implement Customer Journey, Provider Journey, Catalog, Request/Booking, Pricing, Commission, Payment, Fulfillment, Cancellation, Refund, Rating, Notifications and Reports:
- [ ] FOOD
- [ ] CAFES
- [ ] GROCERY
- [ ] FASHION
- [ ] EDU
- [ ] JOBS
- [ ] USED_ITEMS
- [ ] MAINTENANCE
- [ ] FREELANCER
- [ ] ACCOUNTING
- [ ] LEGAL
- [ ] COMPANIES
- [ ] ERP
- [ ] FACTORIES
- [ ] TRAVEL
- [ ] MATRIMONY
- [ ] HEALTH
- [ ] CLINICS
- [ ] HOSPITALS
- [ ] PHARMACY
- [ ] LABS
- [ ] RADIOLOGY
- [ ] DENTAL
- [ ] PHYSIOTHERAPY
- [ ] VETERINARY
- [ ] REAL_ESTATE
- [ ] AUTO
- [ ] FITNESS
- [ ] DIGITAL
- [ ] TECH
- [ ] MANTIGO

## 11 — RBAC / Governance
- [ ] Customer.
- [ ] Provider.
- [ ] Captain.
- [ ] Provider Admin.
- [ ] Operations.
- [ ] Finance.
- [ ] Marketing.
- [ ] CRM.
- [ ] Support.
- [ ] Compliance.
- [ ] Super Admin.
- [ ] Least privilege.
- [ ] Approval separation.
- [ ] Refund/settlement controls.
- [ ] Permission review.
- [ ] Immutable audit.

## 12 — Security
- [ ] RLS review all tables.
- [ ] SECURITY DEFINER review.
- [ ] search_path review.
- [ ] Grants review.
- [ ] Service-role isolation.
- [ ] Secrets/CORS review.
- [ ] Input validation.
- [ ] Rate limiting.
- [ ] Abuse prevention.
- [ ] XSS/CSRF review.
- [ ] Upload security.
- [ ] PII protection.
- [ ] Tenant isolation.
- [ ] Cross-user/provider tests.
- [ ] Session regression.
- [ ] Leaked-password protection.
- [ ] Final Security Advisor.

## 13 — Notifications
- [ ] In-app.
- [ ] Email.
- [ ] Push.
- [ ] Provider/customer lifecycle events.
- [ ] Payment events.
- [ ] Assignment.
- [ ] Cancellation.
- [ ] Completion.
- [ ] Settlement.
- [ ] Rating.
- [ ] Delivery retry/failure.
- [ ] Stale subscription cleanup.
- [ ] Click-through verification.

## 14 — Location
- [ ] Approved map provider.
- [ ] Map UI.
- [ ] Search/geocoding.
- [ ] Reverse geocoding.
- [ ] Pickup/destination markers.
- [ ] Routing.
- [ ] Distance/duration.
- [ ] ETA.
- [ ] Permission UX.
- [ ] Privacy.
- [ ] Offline/failure behavior.
- [ ] No unnecessary continuous tracking.

## 15 — Analytics / Reports
- [ ] GMV.
- [ ] Revenue.
- [ ] Commission.
- [ ] Provider earnings.
- [ ] Orders/completion.
- [ ] Cancellation/no-show.
- [ ] AOV.
- [ ] Repeat customers.
- [ ] Provider retention.
- [ ] Sector performance.
- [ ] Marketing performance.
- [ ] Reconciliation.
- [ ] CSV/XLSX/PDF exports by permission.

## 16 — Content / Design
- [ ] CMS.
- [ ] Banners/offers.
- [ ] Provider content.
- [ ] Moderation.
- [ ] SEO.
- [ ] Accessibility.
- [ ] RTL.
- [ ] English.
- [ ] Responsive.
- [ ] MantiqatiX/MNTY identity consistency.

## 17 — Payments
- [x] Payment-intent baseline.
- [x] Webhook verification/idempotency baseline.
- [ ] Real provider transaction.
- [ ] Real webhook replay.
- [ ] Refund/partial refund.
- [ ] Timeout/retry.
- [ ] Reconciliation.
- [ ] Duplicate-payment E2E.
- [ ] Receipt.

## 18 — Backup / DR
- [ ] Backup policy.
- [ ] Monitoring.
- [ ] Restore rehearsal.
- [ ] PITR verification.
- [ ] RTO/RPO.
- [ ] Disaster recovery runbook.
- [ ] Rollback rehearsal.
- [ ] Emergency access.

## 19 — Testing
- [ ] Unit.
- [ ] Integration.
- [ ] RLS.
- [ ] Auth/Authz.
- [ ] State machine.
- [ ] Concurrency.
- [ ] Idempotency.
- [ ] Cross-tenant.
- [ ] Customer/Provider E2E.
- [ ] Payment E2E.
- [ ] Notification E2E.
- [ ] Browser smoke.
- [ ] Android/device.
- [ ] Offline/reconnect.
- [ ] Load/stress/failure.

Required negative cases:
- [ ] Unauthorized customer.
- [ ] Unauthorized provider/captain.
- [ ] Wrong tenant.
- [ ] Wrong ride.
- [ ] Expired ride.
- [ ] Cancelled ride.
- [ ] Duplicate accept.
- [ ] Duplicate bid.
- [ ] Duplicate payment.
- [ ] Concurrent accept.
- [ ] Invalid transition.
- [ ] Replay webhook.

## 20 — DevOps / Release
- [ ] Build.
- [ ] Lint/static checks.
- [ ] Migration validation.
- [ ] Edge Function deployment verification.
- [ ] CI convergence.
- [ ] Production configuration.
- [ ] Secrets.
- [ ] Domain/HTTPS.
- [ ] Version/tag.
- [ ] Release notes.
- [ ] Rollback artifact.
- [ ] Production smoke.
- [ ] Release approval.

## 21 — Monitoring
- [ ] Errors.
- [ ] Crashes.
- [ ] API latency/errors.
- [ ] Database.
- [ ] Auth.
- [ ] Performance.
- [ ] Security.
- [ ] External providers.
- [ ] Location services.
- [ ] Payment failures.
- [ ] Notification failures.
- [ ] Incident workflow.

## 22 — Definition of Done
Every task must pass:
**Analysis → Impact → Implementation → Integration → Database → Auth/Authz → Security → UI/API → Test → Verification → Release → Monitoring → Baseline**

No evidence = **NOT VERIFIED**.
Blocked dependency = **BLOCKED**.

## 23 — Final Release Gate
Production Ready is forbidden until Core, Auth, Authz, DB, RLS, Security, API, Website, App, Admin, Finance, CRM, Marketing, Provider Operations, Customer Operations, Payments, Notifications, Analytics, Backup, Restore, Monitoring, Build, Signing, External Tests, Rollback and Disaster Recovery are verified.

**FINAL STATUS: NOT CERTIFIED.**
\n\n## 2026-10-06 execution update\n- [x] Secure customer ride tracking RPC deployed live and execute restricted to authenticated users.\n- [x] MantiGO admin/operations KPI RPC deployed live and role-gated.\n- [x] Commission engine live hardening: unique order commission constraint + secure commission preview.\n- [x] Customer MantiGO UI switched to the secured tracking RPC for customer trip history/bids.\n- [ ] Repository sync of commission migration remains NOT VERIFIED because GitHub write was blocked by security checks.\n

- [x] Removed broad direct MantiGO ride/bid/rating/ledger reads from the workspace loader; frontend now consumes authenticated backend RPC boundaries.
- [x] Added live captain earnings dashboard RPC with authenticated-only execution and captain-profile gate.
- [x] Added repository migration for captain earnings RPC.
- [ ] CI/workflow verification for frontend commit `c5caebdeb77e3d78d8cb29a05e3344446fb3c460` remains NOT VERIFIED (no workflow/status records returned).
- [ ] Full customer/captain financial E2E and settlement evidence remains NOT VERIFIED.
