SET ROLE authenticated;
DO $$
DECLARE actor uuid := 'c0000000-0000-4000-8000-000000000001'; payload jsonb; rejected boolean; n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',actor::text,false);
 payload:=public.submit_job_application_backend(actor,'a0000000-0000-4000-8000-000000000001','Applicant','+201000000000','Experience','CV');
 IF payload->>'status'<>'SUBMITTED' THEN RAISE EXCEPTION 'active job rejected'; END IF;
 SELECT count(*) INTO n FROM public.job_applications;
 rejected:=false;
 BEGIN PERFORM public.submit_job_application_backend(actor,'a0000000-0000-4000-8000-000000000002','Applicant','+201000000000','Experience','CV');
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='JOB_NOT_ACTIVE' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected OR (SELECT count(*) FROM public.job_applications)<>n THEN RAISE EXCEPTION 'inactive job not safely rejected'; END IF;
 rejected:=false;
 BEGIN PERFORM public.submit_job_application_backend(actor,'a0000000-0000-4000-8000-000000000099','Applicant','+201000000000','Experience','CV');
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='JOB_NOT_FOUND' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected THEN RAISE EXCEPTION 'missing job not rejected'; END IF;
END $$;
RESET ROLE;
SELECT 'RC919 PASS' AS result;
