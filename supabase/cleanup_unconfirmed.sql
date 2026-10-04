-- Deletes accounts whose email was never confirmed, 7 days after sign-up, every night at 03:00 UTC.
-- With "Confirm email" on, an account made with a mistyped or made-up address can never sign in; this
-- keeps such accounts from piling up in Authentication → Users. Confirmed accounts are never touched.
--
-- Needs the pg_cron extension: Database → Extensions → pg_cron → enable (or the line below does it).
-- Idempotent: re-running replaces the job. Run it in the SQL editor.

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'delete-unconfirmed-users';

select cron.schedule(
  'delete-unconfirmed-users',
  '0 3 * * *',
  $$
    delete from auth.users
    where email_confirmed_at is null
      and confirmed_at is null
      and created_at < now() - interval '7 days'
  $$
);

-- Check afterwards:
--   select jobname, schedule, active from cron.job where jobname = 'delete-unconfirmed-users';
--   select status, start_time, return_message from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'delete-unconfirmed-users')
--     order by start_time desc limit 5;
-- See what the next run would delete:
--   select email, created_at from auth.users
--     where email_confirmed_at is null and confirmed_at is null and created_at < now() - interval '7 days';
