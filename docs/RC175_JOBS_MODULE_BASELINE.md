# RC175 — Jobs Module Activation

- Activated the customer job-application action against the existing `job_applications` contract.
- Application submission sends authenticated `applicant_user_id` and the existing application fields.
- Existing jobs and applications remain RLS-scoped; no new jobs schema was introduced.
- No synthetic job or application records were created.
- OPEN: browser E2E, applicant/employer isolation, employer review lifecycle, notifications, attachments/CV storage, payment/commission if later required, CI and release-gate verification.
