-- Run after a successful invoke_daily_offer_digest(true,true) provider validation.
select cron.schedule('send-daily-offer-digest','0 8 * * *',
  'select public.invoke_daily_offer_digest(false,false);');
