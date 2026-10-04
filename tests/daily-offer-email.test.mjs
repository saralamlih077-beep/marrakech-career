import test from 'node:test';
import assert from 'node:assert/strict';
import {digestEmail,eligibleUser,failureStatus,runDigest} from '../backend/supabase/functions/send-daily-offer-digest/index.ts';

const offer={id:'offer-1',title:'Stage <script>alert(1)</script>',employer:'A & B',location:'Marrakech',contract:'Stage',source:'JobSquare',source_url:'javascript:alert(1)'};
test('email escapes imported content and uses safe company/source links',()=>{
  const mail=digestEmail([offer]);
  assert.match(mail.htmlContent,/&lt;script&gt;/);
  assert.match(mail.htmlContent,/A &amp; B/);
  assert.doesNotMatch(mail.htmlContent,/href="javascript:/);
  assert.match(mail.htmlContent,/\?offer=offer-1/);
  assert.match(mail.htmlContent,/\?alerts=manage/);
  assert.match(mail.textContent,/Source : JobSquare/);
});
test('only confirmed, available Auth accounts are eligible',()=>{
  assert.equal(eligibleUser({email:'a@example.com'}),false);
  assert.equal(eligibleUser({email:'a@example.com',email_confirmed_at:'2026-01-01'}),true);
  assert.equal(eligibleUser({email:'a@example.com',email_confirmed_at:'2026-01-01',banned_until:'2099-01-01'}),false);
});
function fakeService({enabled=true,confirmed=true,offers=[offer],duplicate=false,optOut=false}={}) {
  const calls=[]; let claimed=duplicate; const finished=[];
  const service={calls,finished,auth:{admin:{getUserById:async()=>({data:{user:{email:'registered@example.com',email_confirmed_at:confirmed?'2026-01-01':undefined}}})}},
    from:()=>{
      const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,gt:()=>query,
        maybeSingle:async()=>({data:{enabled:!optOut}}),
        then:resolve=>resolve({data:enabled?[{user_id:'subscriber-1'}]:[]})}; return query;
    },
    rpc:async(name,args)=>{
      calls.push(name);
      if (name==='preview_job_alert_digest') return {data:claimed?[]:offers};
      if (name==='claim_job_alert_digest') {if(claimed||!offers.length)return {data:null};claimed=true;return {data:{id:'reservation-1',offers}};}
      if (name==='finish_job_alert_digest') {finished.push(args);return {};}
      throw new Error(name);
    }};
  return service;
}
test('all sources are grouped into one email to the registration address, once per day',async()=>{
  const service=fakeService({offers:[offer,{...offer,id:'offer-2',source:'Trabajo'}]}); const messages=[];
  const mailer=async(email,digest)=>{messages.push({email,digest});return {status:201,messageId:'brevo-id'};};
  assert.equal((await runDigest(service,mailer,false)).sent,1);
  assert.equal((await runDigest(service,mailer,false)).sent,0);
  assert.equal(messages.length,1);
  assert.equal(messages[0].email,'registered@example.com');
  assert.equal(messages[0].digest.offers.length,2);
  assert.equal(service.finished[0].p_message_id,'brevo-id');
});
test('no preference, no new offers, unconfirmed email or opt-out means no email',async()=>{
  for(const settings of [{enabled:false},{offers:[]},{confirmed:false},{optOut:true}]) {
    const service=fakeService(settings); let sent=0;
    await runDigest(service,async()=>{sent++;return {status:201,messageId:'id'};},false);
    assert.equal(sent,0);
  }
});
test('dry-run neither sends nor reserves offers',async()=>{
  const service=fakeService();
  const result=await runDigest(service,async()=>{throw Error('No mail in dry-run');},true);
  assert.equal(result.plannedRecipients,1);assert.equal(result.plannedOffers,1);
  assert.deepEqual(service.calls,['preview_job_alert_digest']);
});
test('ambiguous delivery is recorded and never retried automatically',async()=>{
  const service=fakeService();let tries=0;
  const mailer=async()=>{tries++;throw Error('Timeout after provider acceptance');};
  assert.equal((await runDigest(service,mailer,false)).unknown,1);
  await runDigest(service,mailer,false);assert.equal(tries,1);
  assert.equal(service.finished[0].p_status,'unknown');
  assert.equal(failureStatus(503),'unknown');assert.equal(failureStatus(429),'failed');
});
