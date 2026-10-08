import { AGENT, FIELDS, officialUrl, readOfficial, robotsAllowed, contactLinks, parseCompany } from './company-web.mjs';

const OVERPASS = 'https://overpass.private.coffee/api/interpreter';
const QUERY = `[out:json][timeout:25];(nwr[office][name][~"^(contact:)?website$"~"."](31.50,-8.16,31.76,-7.82);nwr[shop][name][~"^(contact:)?website$"~"."](31.50,-8.16,31.76,-7.82);nwr[craft][name][~"^(contact:)?website$"~"."](31.50,-8.16,31.76,-7.82);nwr[tourism~"^(hotel|guest_house)$"][name][~"^(contact:)?website$"~"."](31.50,-8.16,31.76,-7.82););out tags 500;`;

async function discover() {
  const options = () => ({ method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':AGENT}, body:new URLSearchParams({data:QUERY}), signal:AbortSignal.timeout(30000), redirect:'error' as RequestRedirect });
  let response = await fetch(OVERPASS, options());
  // One bounded retry for a temporary source-side failure; never loop on rate
  // limits or bypass a source's refusal. The overall collection deadline stays.
  if([500,502,503,504].includes(response.status)) {
    await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000));
    response=await fetch(OVERPASS,options());
  }
  if (!response.ok || !response.body) throw new Error(`discovery_http_${response.status}`);
  const reader = response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  while (true) { const item=await reader.read(); if(item.done) break; size+=item.value.length; if(size>3_000_000) { await reader.cancel(); throw new Error('discovery_too_large'); } chunks.push(item.value); }
  const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(!Array.isArray(body.elements) || body.remark) throw new Error('discovery_incomplete');
  return body.elements.flatMap((item:any)=>{
    try { const url=officialUrl(item.tags?.['contact:website']||item.tags?.website); return [{source_id:`${item.type}/${item.id}`,nom:item.tags.name,site_web:url.href}]; }
    catch { return []; }
  }).slice(0,500);
}

async function verify(candidate:any,deadline:number) {
  const start=officialUrl(candidate.site_web).href;
  const robots=await readOfficial(new URL('/robots.txt',start).href,deadline,128_000);
  if(robots.status!==200 && robots.status!==404) throw new Error('robots_unavailable');
  const rules=robots.status===404?'':robots.text;
  if(!robotsAllowed(rules,start)) throw new Error('robots_denied');
  const permitted=(url:string)=>robotsAllowed(rules,url);
  const home=await readOfficial(start,deadline,1_000_000,0,null,permitted);
  if(home.status!==200) throw new Error('site_unavailable');
  const pages=[{url:start,html:home.text}];
  for(const url of contactLinks(home.text,start)) {
    if(!robotsAllowed(rules,url)) continue;
    await new Promise(resolve=>setTimeout(resolve,400));
    const page=await readOfficial(url,deadline,1_000_000,0,null,permitted);
    if(page.status===200) pages.push({url,html:page.text});
  }
  return parseCompany(pages,start,candidate.discovered_name);
}

Deno.serve(async request=>{
  if(request.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  const secret=Deno.env.get('JOOBLE_SYNC_SECRET')||Deno.env.get('JOBSQUARE_SYNC_SECRET');
  if(!secret || request.headers.get('x-cron-secret')!==secret) return Response.json({error:'Forbidden'},{status:403});
  const {createClient}=await import('npm:@supabase/supabase-js@2');
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  async function rpc(name:string,args:any={}) { const {data,error}=await admin.rpc(name,args); if(error) throw new Error('database_error'); return data; }
  let run;
  try {run=await rpc('begin_new_company_sync');} catch {return Response.json({error:'Cannot start collection'},{status:500});}
  if(!run) return Response.json({status:'already_checked_or_running'});
  const deadline=Date.now()+95_000;
  const results:any={discovered:0,queued:0,checked:0,published:0,pending:0,existing:0,errors:0};
  let status='succeeded';
  try {
    try { const candidates=await discover();results.discovered=candidates.length;results.queued=await rpc('enqueue_company_candidates',{p_candidates:candidates}); }
    catch(error) {
      status='partial';results.discovery='unavailable';
      const message=error instanceof Error ? error.message : 'unknown_error';
      console.warn('company_discovery',message.replace(/https?:\/\/\S+/g,'[source]').slice(0,120));
    }
    const candidates=await rpc('pending_company_candidates');
    for(const candidate of candidates) {
      if(Date.now()>deadline-16000) {status='partial';results.deferred=candidates.length-results.checked;break;}
      try {
        let parsed;let reason='missing_information';
        try {parsed=await verify(candidate,deadline);} catch(error) {
          parsed={data:null,missing:FIELDS,evidence_urls:[]};reason='site_not_verifiable';results.errors++;
          // Diagnostics contain only crawler errors, never credentials or website bodies.
          const message=error instanceof Error ? error.message : 'unknown_error';
          console.warn('company_verification',message.replace(/https?:\/\/\S+/g,'[site]').slice(0,120));
        }
        const saved=await rpc('save_new_company_candidate',{p_source_id:candidate.source_id,p_company:parsed.data,p_missing:parsed.missing,p_evidence:parsed.evidence_urls,p_reason:reason});
        results.checked++;results[saved]++;
      } catch {status='partial';results.errors++;}
    }
    if(results.errors) status='partial';
    if(results.discovery==='unavailable' && results.checked===0) status='failed';
    await rpc('finish_new_company_sync',{p_run:run,p_status:status,p_results:results});
    return Response.json({status,...results},{status:status==='failed'?502:200});
  } catch {
    try {await rpc('finish_new_company_sync',{p_run:run,p_status:'failed',p_results:{...results,error:'collection_failed'}});} catch { /* Stale run is recovered by the next start. */ }
    return Response.json({status:'failed',error:'Collection failed'},{status:500});
  }
});
