-- Run with postgres in a transaction: nothing persists and no provider is called.
begin;
do $$
declare v_user uuid; v_offer uuid; v_expired uuid; v_pending uuid; v_digest jsonb; v_preview jsonb;
begin
  select id into v_user from auth.users where email_confirmed_at is not null
    and not exists(select 1 from public.job_alert_digests d where d.user_id=auth.users.id
      and digest_day=(now() at time zone 'Africa/Casablanca')::date) limit 1;
  if v_user is null then raise exception 'No confirmed account available for rollback test'; end if;
  insert into public.job_alert_preferences(user_id,enabled) values(v_user,false)
  on conflict(user_id) do update set enabled=false;
  if public.claim_job_alert_digest(v_user) is not null then raise exception 'Disabled preference was sent'; end if;
  update public.job_alert_preferences set enabled=true where user_id=v_user;
  if jsonb_array_length(public.preview_job_alert_digest(v_user))<>0 then raise exception 'Old offers replayed'; end if;
  insert into public.job_offers(title,contract_type,description,status) values('Rollback digest offer','internship','Test only','verified') returning id into v_offer;
  insert into public.job_offers(title,contract_type,description,status,expires_at) values('Rollback expired offer','internship','Test only','verified',now()-interval '1 day') returning id into v_expired;
  insert into public.job_offers(title,contract_type,description,status) values('Rollback pending offer','internship','Test only','pending') returning id into v_pending;
  v_preview:=public.preview_job_alert_digest(v_user);
  if jsonb_array_length(v_preview)<>1 or v_preview->0->>'id'<>v_offer::text then raise exception 'Expiry/status filtering failed'; end if;
  update public.job_offers set status='verified' where id=v_pending;
  if jsonb_array_length(public.preview_job_alert_digest(v_user))<>2 then raise exception 'Newly verified offer was lost'; end if;
  v_digest:=public.claim_job_alert_digest(v_user);
  if v_digest is null or jsonb_array_length(v_digest->'offers')<>2 then raise exception 'Digest snapshot failed'; end if;
  if public.claim_job_alert_digest(v_user) is not null then raise exception 'Duplicate daily reservation'; end if;
  perform public.finish_job_alert_digest((v_digest->>'id')::uuid,'sent','rollback-message-id',null);
  if (select count(*) from public.job_alert_deliveries where user_id=v_user and offer_id in(v_offer,v_pending))<>2 then raise exception 'Atomic delivery audit failed'; end if;
  if jsonb_array_length(public.preview_job_alert_digest(v_user))<>0 then raise exception 'Delivered offers replayed'; end if;
  if has_function_privilege('anon','public.claim_job_alert_digest(uuid)','execute')
    or has_function_privilege('authenticated','public.preview_job_alert_digest(uuid)','execute')
    or has_table_privilege('authenticated','public.job_alert_digests','select')
    then raise exception 'Private digest access exposed'; end if;
end $$;
select true as opt_in_expiry_snapshot_and_duplicate_checks_passed;
rollback;
