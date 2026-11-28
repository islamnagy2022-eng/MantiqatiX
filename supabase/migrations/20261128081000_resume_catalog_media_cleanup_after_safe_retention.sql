-- Re-enable hourly cleanup only after the five-day unused-window logic and
-- the matching cleanup Edge Function have been deployed.
do $resume$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'mnty-cleanup-unused-catalog-media';

  if v_job_id is null then
    raise exception 'MNTY_CATALOG_MEDIA_CLEANUP_JOB_MISSING';
  end if;

  perform cron.alter_job(v_job_id, null, null, null, null, true);
end;
$resume$;
