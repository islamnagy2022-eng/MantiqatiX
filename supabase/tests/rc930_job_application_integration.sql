-- RC930 disposable integration assertions. Run only against the RC930 fixture database.
SET ROLE authenticated;
DO $$
DECLARE
  actor uuid := 'c0000000-0000-4000-8000-000000000001';
  payload jsonb;
  first_id uuid;
  rejected boolean;
  before_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', actor::text, false);

  payload := public.submit_job_application_backend(
    actor, 'a0000000-0000-4000-8000-000000000001',
    'Applicant', '+201000000000', 'Experience', 'CV'
  );
  IF payload->>'status' <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'active job rejected: %', payload;
  END IF;
  first_id := (payload->>'id')::uuid;

  payload := public.submit_job_application_backend(
    actor, 'a0000000-0000-4000-8000-000000000001',
    'Applicant', '+201000000000', 'Experience', 'CV'
  );
  IF payload->>'status' <> 'ALREADY_APPLIED' OR (payload->>'id')::uuid <> first_id THEN
    RAISE EXCEPTION 'duplicate submission must remain idempotent: %', payload;
  END IF;

  SELECT count(*) INTO before_count FROM public.job_applications;
  rejected := false;
  BEGIN
    PERFORM public.submit_job_application_backend(
      actor, 'a0000000-0000-4000-8000-000000000002',
      'Applicant', '+201000000000', 'Experience', 'CV'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'JOB_NOT_ACTIVE' THEN rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT rejected OR (SELECT count(*) FROM public.job_applications) <> before_count THEN
    RAISE EXCEPTION 'inactive job was not safely rejected';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.submit_job_application_backend(
      actor, 'a0000000-0000-4000-8000-000000000099',
      'Applicant', '+201000000000', 'Experience', 'CV'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'JOB_NOT_FOUND' THEN rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'missing job was not rejected'; END IF;
END $$;
RESET ROLE;
SELECT 'RC930_INTEGRATION_PASS' AS result;
