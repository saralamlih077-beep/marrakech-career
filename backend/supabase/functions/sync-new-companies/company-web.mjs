import { request } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { Buffer } from 'node:buffer';

export const AGENT = 'MarrakechCareerBot/1.0 (+https://marrakech-career.vercel.app/)';
export const FIELDS = ['nom', 'domaine', 'adresse', 'telephone', 'site_web', 'email'];
const BLOCKED = /(^|\.)(localhost|local|internal|test|invalid|example|facebook\.com|instagram\.com|linkedin\.com|google\.com|googleapis\.com|booking\.com|tripadvisor\.[a-z.]+)$/i;
export const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
export const norm = value => clean(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export const hostKey = value => new URL(value).hostname.toLowerCase().replace(/^www\./, '');

export function officialUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || BLOCKED.test(url.hostname)) throw new Error('unsafe_url');
  url.protocol = 'https:'; url.hash = ''; url.search = '';
  if (url.href.length > 1000) throw new Error('unsafe_url');
  return url;
}

export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

// The validated IP is the address used by the TLS socket; no second DNS lookup.
export function pinnedLookup(hostname, options, callback, resolver = lookup) {
  resolver(hostname, { family: 4, all: true }, (error, addresses) => {
    if (error || !addresses?.length || addresses.some(item => !publicIPv4(item.address))) return callback(new Error('unsafe_dns'));
    if (options?.all) callback(null, [{ address: addresses[0].address, family: 4 }]);
    else callback(null, addresses[0].address, 4);
  });
}

async function resolvePublicAddress(hostname, timeout) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('dns_timeout')),timeout);
    pinnedLookup(hostname,{},(error,address)=>{clearTimeout(timer);error?reject(error):resolve(address);});
  });
}

export function parseHttpResponse(bytes, maxBytes) {
  const separator = bytes.indexOf(Buffer.from('\r\n\r\n'));
  if (separator < 0 || separator > 32768) throw new Error('invalid_headers');
  const lines = bytes.subarray(0, separator).toString('latin1').split('\r\n');
  const status = Number(lines.shift()?.match(/^HTTP\/1\.[01] ([0-9]{3})/)?.[1]);
  if (!status) throw new Error('invalid_headers');
  const headers = {};
  for (const line of lines) { const i=line.indexOf(':'); if(i>0) headers[line.slice(0,i).toLowerCase()]=line.slice(i+1).trim(); }
  if (status >= 300 && status < 400) return {status,location:headers.location,text:''};
  let body=bytes.subarray(separator+4);
  if (headers['content-encoding'] && headers['content-encoding'] !== 'identity') throw new Error('unsupported_encoding');
  if (headers['transfer-encoding']) {
    if (headers['transfer-encoding'].toLowerCase() !== 'chunked') throw new Error('unsupported_encoding');
    const chunks=[];let offset=0;let total=0;let done=false;
    while(offset<body.length){
      const end=body.indexOf(Buffer.from('\r\n'),offset);if(end<0) throw new Error('invalid_chunk');
      const sizeText=body.subarray(offset,end).toString('ascii').split(';')[0];
      if(!/^[0-9a-f]+$/i.test(sizeText)) throw new Error('invalid_chunk');
      const size=parseInt(sizeText,16);offset=end+2;
      if(size===0){done=true;break;}
      total+=size;if(total>maxBytes) throw new Error('too_large');
      if(offset+size+2>body.length || body[offset+size]!==13 || body[offset+size+1]!==10) throw new Error('invalid_chunk');
      chunks.push(body.subarray(offset,offset+size));offset+=size+2;
    }
    if(!done) throw new Error('invalid_chunk');body=Buffer.concat(chunks);
  } else if (headers['content-length'] && (!/^\d+$/.test(headers['content-length']) || Number(headers['content-length'])!==body.length)) throw new Error('truncated_body');
  if(body.length>maxBytes) throw new Error('too_large');
  return {status,text:body.toString('utf8')};
}

// Deno's Node HTTP adapter does not support a custom DNS lookup. Connect to the
// validated IP first, then perform TLS with the ORIGINAL hostname and normal CA
// verification. This preserves both DNS pinning and certificate validation.
export async function readPinnedDeno(url, ip, timeout, maxBytes, runtime = Deno) {
  if(!publicIPv4(ip)) throw new Error('unsafe_dns');
  let connection;let expired=false;let timer;
  const work=(async()=>{
    connection=await runtime.connect({hostname:ip,port:443,transport:'tcp'});
    if(expired){connection.close();throw new Error('timeout');}
    connection=await runtime.startTls(connection,{hostname:url.hostname,alpnProtocols:['http/1.1']});
    if(expired){connection.close();throw new Error('timeout');}
    const requestBytes=new TextEncoder().encode(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nUser-Agent: ${AGENT}\r\nAccept: text/html, text/plain\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
    let sent=0;while(sent<requestBytes.length) sent+=await connection.write(requestBytes.subarray(sent));
    const chunks=[];let total=0;const block=new Uint8Array(16384);
    while(true){const n=await connection.read(block);if(n===null) break;total+=n;if(total>maxBytes+32768) throw new Error('too_large');chunks.push(Buffer.from(block.subarray(0,n)));}
    return parseHttpResponse(Buffer.concat(chunks),maxBytes);
  })();
  try {return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;try{connection?.close();}catch{}reject(new Error('timeout'));},timeout);})]);}
  finally {clearTimeout(timer);try{connection?.close();}catch{}}
}

export async function readOfficial(value, deadline, maxBytes = 1_000_000, redirects = 0, origin = null, allowed = () => true) {
  const url = officialUrl(value);
  if (origin && hostKey(url) !== hostKey(origin)) throw new Error('cross_origin_redirect');
  if (!allowed(url.href)) throw new Error('robots_denied');
  const timeout = Math.min(5000, deadline - Date.now());
  if (timeout <= 0) throw new Error('deadline');
  const result = typeof Deno !== 'undefined' ? await readPinnedDeno(url,
    await resolvePublicAddress(url.hostname,timeout),Math.max(1,Math.min(5000,deadline-Date.now())),maxBytes)
    : await new Promise((resolve, reject) => {
    const req = request(url, { agent: false, family: 4, lookup: pinnedLookup, headers: { 'User-Agent': AGENT, Accept: 'text/html, text/plain', 'Accept-Encoding': 'identity' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400) { res.resume(); resolve({ status: res.statusCode, location: res.headers.location, text: '' }); return; }
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > maxBytes) { req.destroy(new Error('too_large')); return; } chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    const timer = setTimeout(() => req.destroy(new Error('timeout')), timeout);
    req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
  });
  if (result.location) {
    if (redirects >= 2) throw new Error('redirect_limit');
    return readOfficial(new URL(result.location, url).href, deadline, maxBytes, redirects + 1, origin || url.href, allowed);
  }
  return result;
}

export function robotsAllowed(robots, value) {
  const groups = []; let agents = [], rules = [], sawRule = false;
  for (const line of robots.split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').match(/^\s*(user-agent|allow|disallow)\s*:\s*(.*?)\s*$/i);
    if (!match) continue;
    if (match[1].toLowerCase() === 'user-agent') {
      if (sawRule) { groups.push({ agents, rules }); agents = []; rules = []; sawRule = false; }
      agents.push(match[2].toLowerCase());
    } else { sawRule = true; if (match[2]) rules.push({ allow: match[1].toLowerCase() === 'allow', pattern: match[2] }); }
  }
  groups.push({ agents, rules });
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && 'marrakechcareerbot'.includes(a)));
  const selected = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  const path = new URL(value).pathname;
  const matches = selected.flatMap(g => g.rules).filter(r => new RegExp('^' + r.pattern.split('*').map(p => p.replace(/[.+?^{}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$')).test(path));
  matches.sort((a,b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

export function contactLinks(html, base) {
  const urls = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/contact|about|a.propos|qui.sommes|mentions/i.test(match[1] + clean(match[2]))) continue;
    try { const url = officialUrl(new URL(match[1], base).href); if (hostKey(url) === hostKey(base) && !/\.(pdf|jpg|png|zip)$/i.test(url.pathname)) urls.push(url.href); } catch { /* Leave unsafe links unvisited. */ }
  }
  return [...new Set(urls)].slice(0, 2);
}

const DOMAINS = [
  ['IT & Digital', /software|informatique|digital|developpement web|intelligence artificielle|cybersecurite|logiciel/],
  ['Tourisme & Hôtellerie', /hotel|riad|tourisme|travelagency|hebergement/],
  ['Santé', /medical|dentist|physician|hospital|clinique|pharmacy|pharmacie/],
  ['Immobilier & Construction', /realestate|immobili|construction|architect|ingenierie civile/],
  ['Éducation & Formation', /school|college|university|ecole|formation professionnelle/],
  ['Finance & Assurance', /financialservice|bank|insurance|banque|assurance|expertise comptable/],
  ['Industrie & Logistique', /logistique|transport|industrie|fabrication/],
  ['Marketing & Communication', /marketing|publicite|communication|advertising/],
  ['Commerce & Distribution', /store|retail|commerce|distribution|magasin/],
  ['Services aux entreprises', /business consulting|conseil aux entreprises|services aux entreprises/],
];
function objects(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return [];
  return [value, ...Object.values(value).flatMap(v => Array.isArray(v) ? v.flatMap(x => objects(x, depth + 1)) : objects(v, depth + 1))];
}
function address(value) {
  if (!value || typeof value !== 'object') return '';
  if (!value.streetAddress || !/marrak(ech|esh)/i.test(clean(value.addressLocality))) return '';
  return clean([value.streetAddress, value.postalCode, value.addressLocality].filter(Boolean).join(', '));
}
function sameIdentity(a, b) {
  const first = norm(a).replace(/[^\p{L}\p{N}]/gu, '');
  const second = norm(b).replace(/[^\p{L}\p{N}]/gu, '');
  return first.length >= 4 && second.length >= 4 && (first.includes(second) || second.includes(first));
}

export function parseCompany(pages, site, expectedName) {
  const combined = pages.map(p => p.html).join('\n');
  const structured = [];
  for (const page of pages) for (const match of page.html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { structured.push(...objects(JSON.parse(match[1]))); } catch { /* Malformed data is not evidence. */ }
  }
  const business = structured.find(x => x.name && sameIdentity(x.name, expectedName) && /Organization|Business|Store|Hotel|Lodging|Agency|Service|Restaurant|School|College|Dentist|Physician|Hospital|Bank|Insurance|Pharmacy|Corporation/i.test(String(x['@type'])) && (!x.url || (() => { try { return hostKey(x.url) === hostKey(site); } catch { return false; } })()));
  const contact = business?.contactPoint ? (Array.isArray(business.contactPoint) ? business.contactPoint : [business.contactPoint]) : [];
  const title = clean(combined.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const nom = clean(business?.name || (sameIdentity(title, expectedName) ? title : ''));
  let adresse = address(business?.address);
  if (!adresse) {
    const found = [...combined.matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/gi)].map(m => clean(m[1])).find(x => /marrak(ech|esh)/i.test(x) && x.length >= 15 && x.length <= 400 && /\d|rue|avenue|route|quartier|boulevard|lotissement|bureau|zone|imm(euble)?/i.test(x));
    adresse = found || '';
  }
  const ownedEmail = [...combined.matchAll(/href=["']mailto:([^?"'\s]+)/gi)].map(m => clean(m[1]).toLowerCase()).find(email => email.split('@')[1]?.replace(/^www\./,'') === hostKey(site));
  // Public provider addresses require the official contact page's main content;
  // never attribute a web agency's footer contact to the company.
  const mainContacts = pages.filter(p => /contact/i.test(new URL(p.url).pathname)).map(p => p.html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '').join('\n');
  const providerEmail = [...mainContacts.matchAll(/href=["']mailto:([^?"'\s]+)/gi)].map(m => clean(m[1]).toLowerCase()).find(email => /@(gmail|outlook|hotmail|yahoo)\.[a-z.]+$/.test(email));
  const email = clean(business?.email || contact.find(c => c.email)?.email || ownedEmail || providerEmail).replace(/^mailto:/i, '').toLowerCase();
  const telephone = clean(business?.telephone || contact.find(c => c.telephone)?.telephone || mainContacts.match(/href=["']tel:([^"']+)/i)?.[1]);
  // Only the company's own type/description or page title describes its sector.
  const meta = [...combined.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]).join(' ');
  const evidence = norm([business?.['@type'], business?.description, title, meta].filter(Boolean).join(' '));
  const domaine = DOMAINS.find(([, regex]) => regex.test(evidence))?.[0] || '';
  const data = { nom, domaine, adresse, telephone, email, site_web: officialUrl(site).href };
  return { data, missing: missingFields(data), evidence_urls: pages.map(p => p.url) };
}

export function missingFields(data) {
  const missing = FIELDS.filter(k => !clean(data[k]) || /^(n\/?a|non (disponible|classe)|inconnu|unknown|none|null|-|0)$/i.test(norm(data[k])));
  if (!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(data.email || '') || /example\.(com|org)|test@/i.test(data.email || '')) missing.push('email');
  const digits = (data.telephone || '').replace(/\D/g, '');
  if (!/^\+?[\d ().-]+$/.test(data.telephone || '') || digits.length < 8 || digits.length > 15 || /^(\d)\1+$/.test(digits)) missing.push('telephone');
  if (!/marrak(ech|esh)/i.test(data.adresse || '') || clean(data.adresse).length < 15) missing.push('adresse');
  try { officialUrl(data.site_web); } catch { missing.push('site_web'); }
  return [...new Set(missing)];
}
