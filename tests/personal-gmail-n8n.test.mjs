import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as shared from '../backend/supabase/functions/_shared/personal-gmail.ts';
import { isDefinitiveSubmissionRejection } from '../frontend/src/app/applicationDelivery.ts';

test('a lost connection or gateway error retains the pending candidature instead of allowing a duplicate submission', () => {
  for (const status of [undefined, 500, 502, 503, 504]) assert.equal(isDefinitiveSubmissionRejection(status), false);
  for (const status of [400, 401, 403, 409, 413]) assert.equal(isDefinitiveSubmissionRejection(status), true);
});

async function load(name, exported) {
  const file = new URL(`../backend/supabase/functions/${name}/index.ts`, import.meta.url);
  const source = stripTypeScriptTypes((await readFile(file, 'utf8')).replace(/^import .*createClient.*;$/m, '').replace(/^import \{([^\n]+)\} from '\.\.\/_shared\/personal-gmail.ts';$/m, 'const {$1} = shared;').replace('export async function', 'async function'));
  const context = vm.createContext({ shared, URL, URLSearchParams, Response, Request, File, FormData, Blob, crypto, AbortSignal, fetch, console });
  vm.runInContext(source + `\nthis.handler = ${exported};`, context);
  return context.handler;
}
const connectionHandler = await load('gmail-connection', 'handleConnection');
const campaignHandler = await load('send-gmail-campaign', 'handleCampaign');
const deliveryHandler = await load('deliver-gmail-application', 'handleDelivery');
const secret = shared.base64(new Uint8Array(32).fill(5));
const settings = { SUPABASE_URL: 'https://project.supabase.co', GOOGLE_OAUTH_CLIENT_ID: 'client', GOOGLE_OAUTH_CLIENT_SECRET: 'secret', GMAIL_TOKEN_ENCRYPTION_KEY: secret,
  N8N_GMAIL_WEBHOOK_URL: 'https://n8n.example/webhook/personal-gmail', N8N_GMAIL_WEBHOOK_SECRET: 's'.repeat(32) };
const env = key => settings[key];
const request = body => new Request('https://project.supabase.co/functions/v1/gmail-connection', { method: 'POST', headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json', Origin: 'https://marrakech-career.vercel.app' }, body: JSON.stringify(body) });
const id = '12345678-1234-1234-1234-123456789abc';

test('OAuth asks for sending only, suggests registration email, never changes the app session', async () => {
  const calls = [];
  const service = { auth: { getUser: async () => ({ data: { user: { id: 'user-a', email: 'registration@gmail.com' } } }) }, rpc: async (name, params) => { calls.push({name, params}); return {}; } };
  const response = await connectionHandler(request({ action: 'connect', useRegistrationEmail: true, user_id: 'user-b' }), service, env);
  assert.equal(response.status, 200);
  const url = new URL((await response.json()).url);
  assert.equal(url.searchParams.get('login_hint'), 'registration@gmail.com');
  assert.match(url.searchParams.get('scope'), /gmail\.send/);
  assert.doesNotMatch(url.searchParams.get('scope'), /readonly|modify|mail\.google/);
  assert.equal(calls[0].params.p_user_id, 'user-a');
  assert.notEqual(calls[0].params.p_hash, url.searchParams.get('state'));
  assert.equal(calls[0].params.p_hash.length, 64);
});
test('status checks the logged-in owner, rejects missing sessions and arbitrary callback origins', async () => {
  const calls = [];
  const service = { auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) }, rpc: async (name, params) => { calls.push(params); return { data: { email: 'a@gmail.com', scopes: [shared.SEND_SCOPE] } }; } };
  const result = await connectionHandler(request({ action: 'status', user_id: 'user-b' }), service, env);
  assert.equal((await result.json()).email, 'a@gmail.com'); assert.equal(calls[0].p_user_id, 'user-a');
  const missing = new Request('https://project.supabase.co', { method: 'POST', body: '{}' });
  assert.equal((await connectionHandler(missing, service, env)).status, 401);
  const evil = request({ action: 'connect' }); evil.headers.set('origin','https://evil.example');
  assert.equal((await connectionHandler(evil, service, env)).status, 403);
});
test('callback validates the Google email and one-use state, and encrypts the refresh token for its original owner', async () => {
  let consumed = false; const saved = [];
  const service = { rpc: async (name, params) => {
    if (name === 'mc_consume_gmail_oauth') { if (consumed) return { data: null }; consumed = true; return { data: { user_id: 'original-user', origin: 'https://marrakech-career.vercel.app' } }; }
    if (name === 'mc_get_gmail_connection') return { data: null };
    if (name === 'mc_store_gmail_connection') { saved.push(params); return {}; }
    throw Error(name);
  }};
  const fetcher = async url => Response.json(url.includes('/token') ? { access_token: 'temporary-token', refresh_token: 'private-refresh-token', scope: `openid email ${shared.SEND_SCOPE}` } : { email: 'different@gmail.com', email_verified: true });
  const callback = new Request('https://project.supabase.co/functions/v1/gmail-connection?state=nonce&code=one-use-code');
  const response = await connectionHandler(callback, service, env, fetcher);
  assert.match(response.headers.get('location'), /status=connected/);
  assert.equal(saved[0].p_user_id, 'original-user'); assert.equal(saved[0].p_email, 'different@gmail.com');
  assert.equal(await shared.decryptToken(saved[0].p_token, secret), 'private-refresh-token');
  assert.doesNotMatch(response.headers.get('location'), /private|temporary|code/);
  assert.match((await connectionHandler(callback, service, env, fetcher)).headers.get('location'), /status=error/);
  assert.equal(saved.length, 1);
});
test('changing Gmail without a new refresh token cannot reuse another sender’s token', async () => {
  let saved = false;
  const service = { rpc: async name => {
    if (name === 'mc_consume_gmail_oauth') return { data: { user_id: 'user', origin: 'https://marrakech-career.vercel.app' } };
    if (name === 'mc_get_gmail_connection') return { data: { email: 'old@gmail.com', encrypted_refresh_token: 'old-token' } };
    if (name === 'mc_store_gmail_connection') saved = true;
    return {};
  }};
  const fetcher = async url => Response.json(url.includes('/token') ? { access_token:'token', scope: `openid email ${shared.SEND_SCOPE}` } : { email: 'new@gmail.com', email_verified:true });
  const result = await connectionHandler(new Request('https://project.supabase.co?state=nonce&code=code'), service, env, fetcher);
  assert.match(result.headers.get('location'), /status=error/); assert.equal(saved, false);
});

function campaignService() {
  const calls = []; const jobs = new Map();
  const query = { insert: async data => { calls.push(['insert',data]); return {}; }, update: () => query, in: () => query, eq: async () => ({}) };
  return { calls, jobs, auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) }, from: () => query,
    storage: { from: () => ({ upload: async () => { calls.push(['upload']); return {}; }, remove: async () => ({}) }) },
    rpc: async (name, params) => {
      if (name === 'mc_get_gmail_connection') return { data: { email:'personal@gmail.com', scopes:[shared.SEND_SCOPE] } };
      if (name === 'mc_get_gmail_job') return { data: jobs.get(params.p_id) ?? null };
      if (name === 'mc_create_gmail_job') { jobs.set(params.p_job.id, params.p_job); return {}; }
      throw Error(name);
    }};
}
function campaignRequest() {
  const form = new FormData(); form.append('requestId', id); form.append('cv', new File(['CV sample'], 'cv.pdf', {type:'application/pdf'}));
  form.append('subject','Candidature'); form.append('message','Bonjour'); form.append('position','Stage');
  form.append('candidates', JSON.stringify([{id:1,name:'Entreprise',email:'hr@example.com'}]));
  return new Request('https://project.supabase.co', { method:'POST', headers:{ Authorization:'Bearer session' }, body:form });
}
test('n8n acceptance is queued, never sent; no private CV, letter or Google tokens enter its payload', async () => {
  const service = campaignService(); const dispatched = [];
  const fetcher = async (url, options) => { dispatched.push(JSON.parse(options.body)); return Response.json({sent:true}); };
  const response = await campaignHandler(campaignRequest(), service, env, fetcher);
  assert.equal(response.status,202); const output = await response.json(); assert.equal(output.status,'queued'); assert.equal(output.sent,undefined);
  assert.deepEqual(Object.keys(dispatched[0]).sort(), ['dispatchToken','jobId']);
  assert.equal(service.jobs.get(id).user_id,'user-a'); assert.equal(service.jobs.get(id).sender_email,'personal@gmail.com');
  assert.notEqual(service.jobs.get(id).token_hash, dispatched[0].dispatchToken);
  assert.equal((await campaignHandler(campaignRequest(), service, env, fetcher)).status,202);
  assert.equal(dispatched.length,1); assert.equal(service.calls.filter(c=>c[0]==='upload').length,1);
});
test('missing n8n configuration does not save or send a candidature; dispatch timeout never retries automatically', async () => {
  const service = campaignService(); let dispatched = 0;
  const absent = key => key.startsWith('N8N_') ? undefined : env(key);
  assert.equal((await campaignHandler(campaignRequest(),service,absent)).status,503); assert.equal(service.calls.length,0);
  const response = await campaignHandler(campaignRequest(),service,env,async()=>{dispatched++;throw Error('timeout after acceptance');});
  assert.equal(response.status,202); assert.equal(dispatched,1);
  await campaignHandler(campaignRequest(),service,env,async()=>{dispatched++;}); assert.equal(dispatched,1);
});

async function deliveryScenario({gmailStatus=200,payload={id:'gmail-message'},timeout=false,changed=false}={}) {
  const dispatchToken = shared.randomToken(); const tokenHash = await shared.tokenHash(dispatchToken); let claimed = false; const finishes = [], tracking = [], requests = [];
  const job = { id,user_id:'user-a',sender_email:'personal@gmail.com',payload:{ recipients:[{email:'hr@example.com',applicationId:id}], subject:'Candidature été',message:'Bonjour, voici mon CV.',cvName:'CV été.pdf',cvType:'application/pdf',cvPath:'private/cv' } };
  const connection = {email:changed?'other@gmail.com':'personal@gmail.com',scopes:[shared.SEND_SCOPE],encrypted_refresh_token:await shared.encryptToken('refresh-for-user-a',secret)};
  const query = { update: data => {tracking.push(data);return query;}, eq: () => query, in: () => query, then: resolve => resolve({}) };
  const service = { from:()=>query, storage:{from:()=>({download:async()=>({data:new Blob(['real cv'])}),remove:async()=>({})})},rpc:async(name,params)=>{
    if(name==='mc_claim_gmail_job'){if(claimed||params.p_hash!==tokenHash)return {data:null};claimed=true;return {data:job};}
    if(name==='mc_get_gmail_connection')return {data:connection};
    if(name==='mc_finish_gmail_job'){finishes.push(structuredClone(params));return {};}
    throw Error(name);
  }};
  const fetcher=async(url,options)=>{requests.push({url,options});if(url.includes('/token'))return Response.json({access_token:'access-for-user-a',scope:shared.SEND_SCOPE});if(timeout)throw Error('lost confirmation');return Response.json(payload,{status:gmailStatus});};
  const req = () => new Request('https://project.supabase.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:id,dispatchToken})});
  return {service,fetcher,req,finishes,tracking,requests};
}
test('delivery uses the personal sender, contains the real CV, records Gmail’s message ID, and rejects a replay', async()=>{
  const s=await deliveryScenario();const response=await deliveryHandler(s.req(),s.service,env,s.fetcher);
  assert.equal((await response.json()).sent,1);assert.equal(s.tracking[0].statut,'applied');assert.equal(s.tracking[0].delivery_status,'sent');
  const send=s.requests.find(r=>r.url.includes('/messages/send')); assert.equal(send.options.headers.Authorization,'Bearer access-for-user-a');
  const raw=JSON.parse(send.options.body).raw;const mime=Buffer.from(raw,'base64url').toString();
  assert.match(mime,/From: personal@gmail.com\r\nTo: hr@example.com/);assert.match(mime,/cmVhbCBjdg==/);
  assert.equal(s.finishes.at(-1).p_results[0].messageId,'gmail-message');
  assert.equal((await deliveryHandler(s.req(),s.service,env,s.fetcher)).status,409);assert.equal(s.requests.filter(r=>r.url.includes('/messages/send')).length,1);
});
test('unconfirmed Gmail success, server errors and timeouts remain unknown; explicit rejection remains failed',async()=>{
  for(const options of [{payload:{}},{gmailStatus:503,payload:{error:'unavailable'}},{timeout:true},{gmailStatus:403,payload:{error:'denied'}}]){
    const s=await deliveryScenario(options);await deliveryHandler(s.req(),s.service,env,s.fetcher);
    const expected=options.gmailStatus===403?'failed':'unknown';assert.equal(s.tracking[0].statut,'prepared');assert.equal(s.finishes.at(-1).p_results[0].status,expected);
    await deliveryHandler(s.req(),s.service,env,s.fetcher);assert.equal(s.requests.filter(r=>r.url.includes('/messages/send')).length,1);
  }
});
test('a changed sender or an invalid dispatch capability cannot send from another account',async()=>{
  const s=await deliveryScenario({changed:true});await deliveryHandler(s.req(),s.service,env,s.fetcher);assert.equal(s.requests.length,0);
  const invalid=new Request('https://project.supabase.co',{method:'POST',body:JSON.stringify({jobId:id,dispatchToken:'forged'})});
  assert.equal((await deliveryHandler(invalid,s.service,env,s.fetcher)).status,401);
});
test('MIME addresses reject injected headers and only actual Gmail IDs prove success',()=>{
  assert.throws(()=>shared.mimeMessage('a@gmail.com','hr@example.com\r\nBcc: bad@example.com','x','x',new Uint8Array(),'x.pdf','application/pdf'));
  assert.throws(()=>shared.normalizeRecipients([{email:'hr@example.com'},{email:'HR@example.com'}]));
  assert.equal(shared.confirmedDelivery(200,{}),null);assert.equal(shared.confirmedDelivery(500,{id:'x'}),null);
});
