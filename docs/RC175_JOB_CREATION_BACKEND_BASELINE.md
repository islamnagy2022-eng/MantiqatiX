# RC175 — Job Creation Backend Authority

- Job creation moved from direct client INSERT to `create_job_backend`.
- Backend requires `auth.uid()` to match the caller and an ACTIVE membership in the target tenant/business.
- Allowed creator roles: OWNER, BUSINESS_OWNER, ADMIN, MANAGER, SERVICE_PROVIDER, STAFF.
- The backend owns `owner_user_id` and `is_active` values.
- No job records were created during verification.
- Browser E2E, job application lifecycle, cross-tenant isolation, notifications, and CI remain NOT VERIFIED.
