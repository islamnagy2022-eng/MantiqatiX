# RC175 — Jobs Application Activation

- Reviewed the live `jobs` and `job_applications` schema and RLS policies.
- Activated a real applicant journey from the existing jobs list.
- Application writes use the existing `job_applications_insert_self` RLS boundary.
- No new jobs schema or parallel application model was introduced.
- No fake jobs/applications were created.
- OPEN: browser E2E, employer/applicant isolation, application review lifecycle, notifications, and CI/release verification.
