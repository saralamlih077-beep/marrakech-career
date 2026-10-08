import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, officialUrl, publicIPv4, pinnedLookup, robotsAllowed, contactLinks, parseCompany, missingFields, readOfficial, readPinnedDeno, parseHttpResponse } from '../backend/supabase/functions/sync-new-companies/company-web.mjs';

const company={nom:'Atlas Logiciels',domaine:'IT & Digital',adresse:'12 avenue Mohamed V, Marrakech 40000',telephone:'+212 524 123 456',site_web:'https://atlas-logiciels.ma/',email:'contact@atlas-logiciels.ma'};
const ld={ '@context':'https://schema.org','@type':'LocalBusiness',name:company.nom,url:company.site_web,description:'Entreprise de développement de logiciel informatique',email:company.email,telephone:company.telephone,address:{'@type':'PostalAddress',streetAddress:'12 avenue Mohamed V',addressLocality:'Marrakech',postalCode:'40000'}};
const pages=[{url:company.site_web,html:`<script type="application/ld+json">${JSON.stringify(ld)}</script>`}];

test('all six fields are necessary; placeholders and invented contacts rejected',()=>{
  assert.deepEqual(missingFields(company),[]);
  for(const key of FIELDS) assert.ok(missingFields({...company,[key]:''}).includes(key),key);
  for(const email of ['test@example.com','not-an-email','contact@localhost']) assert.ok(missingFields({...company,email}).includes('email'));
  for(const telephone of ['0000000000','N/A','123','12345678901234567']) assert.ok(missingFields({...company,telephone}).includes('telephone'));
  assert.ok(missingFields({...company,adresse:'Casablanca'}).includes('adresse'));
});
test('official structured data supplies six fields without taking OSM contacts',()=>{
  const result=parseCompany(pages,company.site_web,'Atlas Logiciels');
  assert.deepEqual(result.missing,[]);assert.equal(result.data.nom,company.nom);assert.equal(result.data.email,company.email);assert.equal(result.data.domaine,'IT & Digital');
});
test('different company, external publisher, missing sector and missing street remain pending',()=>{
  const parse=value=>parseCompany([{url:company.site_web,html:`<script type="application/ld+json">${JSON.stringify(value)}</script>`}],company.site_web,company.nom);
  assert.ok(parse({...ld,name:'Un autre cabinet'}).missing.includes('nom'));
  assert.ok(parse({...ld,url:'https://another-company.ma/'}).missing.includes('nom'));
  assert.ok(parse({...ld,description:'Bienvenue'}).missing.includes('domaine'));
  assert.ok(parse({...ld,address:{addressLocality:'Marrakech'}}).missing.includes('adresse'));
});
test('a web agency footer cannot supply the company email or telephone',()=>{
  const data={...ld};delete data.email;delete data.telephone;
  const result=parseCompany([{url:company.site_web,html:`<script type="application/ld+json">${JSON.stringify(data)}</script><footer><a href="mailto:webmaster@agency.ma">Web agency</a><a href="tel:0524111222">Contact agency</a></footer>`}],company.site_web,company.nom);
  assert.ok(result.missing.includes('email'));assert.ok(result.missing.includes('telephone'));
});
test('URLs cannot target private networks, credentials, social profiles or unusual ports',()=>{
  for(const url of ['http://localhost/','https://127.0.0.1/','https://[::1]/','https://2130706433/','https://user:password@site.ma/','https://site.ma:8443/','file:///etc/passwd','https://facebook.com/page','https://server.internal/']) assert.throws(()=>officialUrl(url));
  assert.equal(officialUrl('http://www.site.ma/?tracking=1').href,'https://www.site.ma/');
  for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','169.254.169.254','100.64.0.1','192.168.0.1','198.18.0.1','203.0.113.1','224.0.0.1','::1']) assert.equal(publicIPv4(ip),false,ip);
  assert.equal(publicIPv4('1.1.1.1'),true);
});
test('DNS pinning rejects a mixed public/private answer and uses the validated address',async()=>{
  const resolve=addresses=>new Promise(resolve=>pinnedLookup('site.ma',{},(error,address)=>resolve({error,address}),(_h,_o,cb)=>cb(null,addresses)));
  assert.ok((await resolve([{address:'1.1.1.1'},{address:'127.0.0.1'}])).error);
  assert.equal((await resolve([{address:'1.1.1.1'}])).address,'1.1.1.1');
});
test('robots specific-agent and longest-path rules respected',()=>{
  const robots='User-agent: *\nDisallow: /private\nAllow: /private/contact\n';
  assert.equal(robotsAllowed(robots,'https://site.ma/private/admin'),false);
  assert.equal(robotsAllowed(robots,'https://site.ma/private/contact'),true);
  assert.equal(robotsAllowed('User-agent: MarrakechCareerBot\nDisallow: /\nUser-agent: *\nAllow: /','https://site.ma/'),false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /*?\nDisallow: /secret$','https://site.ma/secret'),false);
});
test('contact crawling limited to same-site HTTPS and deadline prevents network calls',async()=>{
  const links=contactLinks('<a href="/contact">Contact</a><a href="https://127.0.0.1/contact">Contact</a><a href="https://other.ma/contact">Contact</a><a href="/about">À propos</a><a href="/mentions">Mentions</a>',company.site_web);
  assert.deepEqual(links,['https://atlas-logiciels.ma/contact','https://atlas-logiciels.ma/about']);
  await assert.rejects(readOfficial(company.site_web,Date.now()-1),/deadline/);
  await assert.rejects(readOfficial('https://other.ma/',Date.now()+1000,1000,1,company.site_web),/cross_origin/);
});
test('Deno uses pinned public IP for TCP and official hostname for TLS, never disables certificate checks',async()=>{
  const calls=[];let returned=false;
  const connection={write:async bytes=>bytes.length,read:async bytes=>{if(returned)return null;returned=true;const response=Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello');bytes.set(response);return response.length;},close:()=>{}};
  const runtime={connect:async options=>{calls.push(options);return connection;},startTls:async(_c,options)=>{calls.push(options);return connection;}};
  const result=await readPinnedDeno(new URL('https://site.ma/contact'),'1.1.1.1',1000,1000,runtime);
  assert.equal(result.text,'hello');assert.deepEqual(calls,[{hostname:'1.1.1.1',port:443,transport:'tcp'},{hostname:'site.ma',alpnProtocols:['http/1.1']}]);
  await assert.rejects(readPinnedDeno(new URL('https://site.ma/'),'127.0.0.1',1000,1000,runtime),/unsafe_dns/);
});
test('HTTP decoder rejects truncated/oversized bodies and validates chunked transfer',()=>{
  assert.equal(parseHttpResponse(Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n'),100).text,'hello');
  assert.throws(()=>parseHttpResponse(Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nhello'),100),/truncated/);
  assert.throws(()=>parseHttpResponse(Buffer.from('HTTP/1.1 200 OK\r\n\r\nhello'),3),/too_large/);
  assert.throws(()=>parseHttpResponse(Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n9\r\nhello'),100),/invalid_chunk/);
});
