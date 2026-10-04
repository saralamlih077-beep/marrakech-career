// Source pages are fetched server-side. No public client may start an import.
export const SOURCES = [
  { name: 'jobsquare', label: 'JobSquare', origin: 'https://www.jobsquare.ma', listing: '/cities/jobs-in-Marrakech/', job: /^\/job\/\d+\// },
  { name: 'joobaz', label: 'Joobaz', origin: 'https://joobaz.com', listing: '/jobs/city/marrakech-marrakech-safi-morocco', job: /^\/job\/[^/]+$/ },
  { name: 'maremploi', label: 'Maremploi', origin: 'https://maremploi.com', listing: '/emplois/marrakech/', job: /^\/emploi\/[^/]+\/$/ },
] as const;
const AGENT = 'MarrakechCareerBot/1.0 (+https://marrakech-career.vercel.app/)';
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://marrakech-career.vercel.app', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret' };

export function clean(value: unknown): string {
  return String(value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&#x([a-f0-9]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(?:nbsp|amp|quot|apos|lt|gt|eacute|egrave|ecirc|agrave|acirc|ocirc|ugrave|ccedil);/gi, (m) => ({ '&nbsp;':' ', '&amp;':'&', '&quot;':'"', '&apos;':"'", '&lt;':'<', '&gt;':'>', '&eacute;':'é', '&egrave;':'è', '&ecirc;':'ê', '&agrave;':'à', '&acirc;':'â', '&ocirc;':'ô', '&ugrave;':'ù', '&ccedil;':'ç' }[m.toLowerCase()] || ' '))
    .replace(/\s+/g, ' ').trim();
}

export function canonicalUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), base);
    if (url.protocol !== 'https:' || url.username || url.password || url.origin !== new URL(base).origin) return null;
    url.search = ''; url.hash = '';
    if (url.hostname === 'www.jobsquare.ma') url.hostname = 'jobsquare.ma';
    return url.href;
  } catch { return null; }
}

export function allowedByRobots(robots: string, url: string): boolean {
  const groups: { agents: string[]; rules: { path: string; allow: boolean }[] }[] = [];
  let group: typeof groups[number] | null = null;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    const m = line.match(/^(User-agent|Allow|Disallow):\s*(.*)$/i);
    if (!m) continue;
    if (m[1].toLowerCase() === 'user-agent') {
      if (!group || group.rules.length) { group = { agents: [], rules: [] }; groups.push(group); }
      group.agents.push(m[2].toLowerCase());
    } else if (group && m[2]) group.rules.push({ path: m[2], allow: m[1].toLowerCase() === 'allow' });
  }
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && AGENT.toLowerCase().includes(a)));
  const selected = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  const target = new URL(url).pathname + new URL(url).search;
  let best = -1, allow = true;
  for (const rule of selected.flatMap(g => g.rules)) {
    const end = rule.path.endsWith('$');
    const pattern = rule.path.replace(/\$$/, '').split('*').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    const length = rule.path.replace(/\*/g, '').length;
    if (new RegExp('^' + pattern + (end ? '$' : '')).test(target) && (length > best || (length === best && rule.allow))) { best = length; allow = rule.allow; }
  }
  return allow;
}

export function jobLinks(html: string, source: typeof SOURCES[number]): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const url = canonicalUrl(match[1], source.origin);
    if (url && source.job.test(new URL(url).pathname)) links.add(url);
  }
  return [...links];
}

// Some public JobPosting JSON contains literal newlines inside string values.
export function jsonLdJobs(html: string): any[] {
  const jobs: any[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if ([node['@type']].flat().includes('JobPosting')) jobs.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let inside = false, escaped = false, repaired = '';
    for (const c of m[1]) {
      if (c === '"' && !escaped) inside = !inside;
      repaired += inside && c.charCodeAt(0) < 32 ? JSON.stringify(c).slice(1,-1) : c;
      escaped = c === '\\' && !escaped;
    }
    try { visit(JSON.parse(repaired)); } catch { /* Skip malformed structured data, never scrape page navigation. */ }
  }
  return jobs;
}

export function dateValue(value: unknown, endOfDay = false): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T|$)/.test(value)) return null;
  const candidate = /^\d{4}-\d\d-\d\d$/.test(value) ? value + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00Z') : value;
  const time = Date.parse(candidate);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function contractType(type: unknown, title: string): string | null {
  const text = clean(Array.isArray(type) ? type.join(' ') : type).toLowerCase();
  if (/intern|stage|apprentice/.test(text) || /\bstage\b|stagiaire|\bintern\b/i.test(title)) return 'internship';
  if (/freelance|indépendant/.test(text)) return 'freelance';
  if (/\bcdd\b|temporary|temporaire/.test(text)) return 'cdd';
  if (/\bcdi\b|permanent/.test(text)) return 'cdi';
  if (/full.?time|temps plein/.test(text)) return 'full_time';
  return null;
}

export function parseJob(html: string, url: string, source: string, now = Date.now()) {
  const job = jsonLdJobs(html)[0];
  if (!job) return null;
  const title = clean(job.title).slice(0,300);
  const locations = [job.jobLocation].flat().filter(Boolean).map((p: any) => p.address || {});
  const location = clean(locations.map((a: any) => [a.addressLocality, a.addressRegion, typeof a.addressCountry === 'string' ? a.addressCountry : a.addressCountry?.name].filter(Boolean).join(', ')).join(' / '));
  if (!title || !/marrak(?:ech|esh)/i.test(location)) return null;
  const expires = dateValue(job.validThrough, true);
  const type = contractType(job.employmentType, title);
  // Unknown contracts are skipped rather than misrepresented as CDI.
  if (!type) return null;
  const employer = clean(job.hiringOrganization?.name).slice(0,250) || null;
  const details = clean(job.description);
  const dictionary = ['Python','JavaScript','TypeScript','React','Node.js','SQL','Excel','Power BI','SEO','Marketing digital','Data science','Intelligence artificielle','Français','Anglais','Arabe','Communication','Vente','Comptabilité','Gestion','Hôtellerie','Accueil','Réservation'];
  const normalized = `${title} ${details}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const skills = dictionary.filter(s => new RegExp('(?:^|[^a-z0-9])' + s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])').test(normalized));
  // Store factual metadata and a link, not a copy of the source's full description.
  const label = { jobsquare:'JobSquare', joobaz:'Joobaz', maremploi:'Maremploi' }[source] || source;
  return { title, employer_name: employer, contract_type: type, contract_label: clean(job.employmentType), location,
    description: `Poste : ${title}. ${employer ? `Entreprise : ${employer}. ` : ''}Lieu : ${location}. Consultez l’annonce ${label} pour les missions, les conditions et la candidature.`,
    requirements: '', skills, source_url: url, source_name: source,
    source_external_id: clean(job.identifier?.value) || new URL(url).pathname,
    published_at: dateValue(job.datePosted), publication_date_estimated:false, expires_at: expires,
    offer_domain: clean(job.occupationalCategory) || null,
    status: expires && Date.parse(expires) <= now ? 'closed' : 'verified' };
}

async function readPage(url: string, deadline: number): Promise<string> {
  if (Date.now() > deadline) throw new Error('Délai de collecte atteint');
  const response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept:'text/html, text/plain' }, signal: AbortSignal.timeout(8000), redirect:'error' });
  if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Page source trop volumineuse');
  return text;
}

async function collectPublic(source: typeof SOURCES[number], deadline: number) {
  const robots = await readPage(source.origin + '/robots.txt', deadline);
  const listingUrl = source.origin + source.listing;
  if (!allowedByRobots(robots, listingUrl)) throw new Error('Collecte interdite par robots.txt');
  const listing = await readPage(listingUrl, deadline);
  const urls = jobLinks(listing, source).slice(0, 30);
  if (!urls.length) throw new Error('Aucune annonce détectée : source ou format à vérifier');
  const offers: any[] = []; let skipped = 0, failed = 0;
  // Small batches bound concurrency and protect each source from bursts.
  for (let i=0; i<urls.length; i+=3) {
    if (Date.now() > deadline) { failed += urls.length-i; break; }
    await Promise.all(urls.slice(i,i+3).map(async url => {
      const fetchUrl = source.name === 'jobsquare' ? url.replace('https://jobsquare.ma/','https://www.jobsquare.ma/') : url;
      if (!allowedByRobots(robots, fetchUrl)) { skipped++; return; }
      try {
        const offer = parseJob(await readPage(fetchUrl,deadline), url,source.name);
        if (offer) offers.push(offer); else skipped++;
      } catch { failed++; }
    }));
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return { offers, discovered: urls.length, skipped, failed, status: failed ? 'partial' : 'succeeded' };
}

async function collectJooble(deadline: number) {
  const key = Deno.env.get('JOOBLE_API_KEY');
  if (!key) throw new Error('Clé JOOBLE_API_KEY manquante');
  const offers: any[] = []; let discovered=0, skipped=0;
  for (const keyword of ['stage','emploi']) {
    if (Date.now()>deadline) break;
    const response = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({keywords:keyword,location:'Marrakech, Maroc',page:1,ResultOnPage:50}), signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`API Jooble HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.jobs)) throw new Error('Format API Jooble inattendu');
    discovered += data.jobs.length;
    for (const job of data.jobs) {
      const title=clean(job.title), location=clean(job.location), type=contractType(job.type,title);
      let url: URL;
      try { url=new URL(job.link); } catch { skipped++; continue; }
      if (!title || !type || !/marrak(?:ech|esh)/i.test(location) || !['https:','http:'].includes(url.protocol) || url.username || url.password) { skipped++; continue; }
      offers.push({title, location, contract_type:type, employer_name:clean(job.company)||null, description:clean(job.snippet).slice(0,750)||`Consultez l’annonce Jooble pour les détails du poste ${title}.`, requirements:'', skills:[], source_name:'jooble', source_url:url.href, source_external_id:String(job.id || url.href), published_at:dateValue(job.updated), publication_date_estimated:false, expires_at:null,status:'verified'});
    }
  }
  return { offers:[...new Map(offers.map(o=>[o.source_url,o])).values()],discovered,skipped,failed:0,status:'succeeded' };
}

if (typeof Deno !== 'undefined') Deno.serve(async (request: Request) => {
  if (request.method==='OPTIONS') return new Response('ok',{headers});
  if (request.method!=='POST') return Response.json({error:'Method not allowed'},{status:405,headers});
  const secret=Deno.env.get('JOOBLE_SYNC_SECRET')||Deno.env.get('JOBSQUARE_SYNC_SECRET');
  if (!secret || request.headers.get('x-cron-secret')!==secret) return Response.json({error:'Forbidden'},{status:403,headers});
  const { createClient }=await import('npm:@supabase/supabase-js@2');
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const startedAt=new Date().toISOString();
  const {data:run,error:lockError}=await admin.rpc('begin_career_offer_sync');
  if(lockError) return Response.json({error:'Impossible de démarrer la collecte'},{status:500,headers});
  if(!run) return Response.json({status:'already_running'},{status:409,headers});
  const deadline=Date.now()+100_000;
  const results: any[]=[];
  for(const name of [...SOURCES.map(s=>s.name),'jooble']) {
    try {
      const source=SOURCES.find(s=>s.name===name);
      const result=source ? await collectPublic(source,deadline) : await collectJooble(deadline);
      const {data:counts,error}=await admin.rpc('save_career_offer_batch',{p_source:name,p_offers:result.offers});
      if(error) throw new Error('Enregistrement Supabase impossible');
      results.push({source:name,...result,offers:undefined,...counts});
    } catch(error) {
      // Never return upstream response bodies, URLs containing keys, or SDK errors.
      const message=error instanceof Error ? error.message : 'Collecte impossible';
      results.push({source:name,status:'failed',error:message.startsWith('API Jooble HTTP')||message.startsWith('Source HTTP')||['Clé JOOBLE_API_KEY manquante','Collecte interdite par robots.txt','Aucune annonce détectée : source ou format à vérifier','Délai de collecte atteint','Enregistrement Supabase impossible'].includes(message)?message:'Source inaccessible ou format incompatible'});
    }
  }
  const status=results.every(r=>r.status==='succeeded')?'succeeded':results.some(r=>r.status==='succeeded'||r.status==='partial')?'partial':'failed';
  const {error:finishError}=await admin.rpc('finish_career_offer_sync',{p_run:run,p_status:status,p_results:results});
  if(finishError) return Response.json({status:'failed',error:'Journal de collecte non enregistré'},{status:500,headers});
  return Response.json({status,startedAt,results},{status:status==='failed'?502:200,headers});
});
