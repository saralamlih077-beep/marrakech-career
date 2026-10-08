begin;
do $$
declare v_command text;
begin
  select command into v_command from cron.job where jobname='sync-job-opportunities-daily';
  if v_command is null or position('jooble_sync_cron_secret' in v_command)=0 or position('/functions/v1/sync-job-opportunities' in v_command)=0 then raise exception 'Authenticated cron template missing'; end if;
  v_command:=replace(v_command,'/functions/v1/sync-job-opportunities','/functions/v1/sync-new-companies');
  if position('timeout_milliseconds' in v_command)>0 then
    v_command:=regexp_replace(v_command,'timeout_milliseconds\s*(:=|=>)\s*[0-9]+','timeout_milliseconds := 120000','gi');
  else
    v_command:=regexp_replace(v_command,'\)\s*;?\s*$',', timeout_milliseconds := 120000);');
  end if;
  perform cron.schedule('sync-new-companies-daily','0 5 * * *',v_command);
end $$;
commit;
