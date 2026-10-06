-- Production cleanup: remove duplicate redundant job application index.
-- The canonical UNIQUE constraint already provides (job_id, applicant_user_id).
drop index if exists public.job_applications_job_applicant_uq;
