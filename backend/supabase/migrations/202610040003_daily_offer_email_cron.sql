-- Reuse the authenticated server-side template; do not expose or duplicate credentials.
begin;
create or replace function public.invoke_daily_offer_digest(p_dry_run boolean default true,p_verify_provider boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_command text; v_request bigint;
begin
  select command into v_command from cron.job where jobname='sync-job-opportunities-daily';
  if v_command is null or position('jooble_sync_cron_secret' in v_command)=0
    or position('/functions/v1/sync-job-opportunities' in v_command)=0
    or position('Authorization' in v_command)=0 or position('x-cron-secret' in v_command)=0
    then raise exception 'Authenticated cron template missing'; end if;
  v_command:=replace(v_command,'/functions/v1/sync-job-opportunities','/functions/v1/send-daily-offer-digest');
  if v_command !~ $pattern$body\s*(:=|=>)\s*'[^']*'::jsonb$pattern$ then raise exception 'Expected JSON cron body missing'; end if;
  v_command:=regexp_replace(v_command,$pattern$body\s*(:=|=>)\s*'[^']*'::jsonb$pattern$,
    'body := '||quote_literal(jsonb_build_object('dryRun',p_dry_run,'verifyProvider',p_verify_provider)::text)||'::jsonb');
  if position('timeout_milliseconds' in v_command)>0 then
    v_command:=regexp_replace(v_command,'timeout_milliseconds\s*(:=|=>)\s*[0-9]+','timeout_milliseconds := 120000','gi');
  else v_command:=regexp_replace(v_command,'\)\s*;?\s*$',', timeout_milliseconds := 120000);'); end if;
  execute v_command into v_request;
  return v_request;
end; $$;
revoke all on function public.invoke_daily_offer_digest(boolean,boolean) from public,anon,authenticated;
grant execute on function public.invoke_daily_offer_digest(boolean,boolean) to service_role;
-- Enable only after protected dry-run and sender checks succeed.
commit;
