-- Create a scheduled job to process expired transactions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on pg_cron to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the job to run every hour
SELECT cron.schedule(
  'process-expired-transactions', -- job name
  '0 * * * *',                   -- cron schedule (every hour at minute 0)
  $$
  SELECT public.process_expired_transactions();
  $$
);

-- Add a comment explaining the job
COMMENT ON FUNCTION public.process_expired_transactions() IS 'Automatically cancels pending transactions that have exceeded their time limit and returns funds to sender';