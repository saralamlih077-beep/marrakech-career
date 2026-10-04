import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, allowedByRobots, canonicalUrl, jobLinks, jsonLdJobs, parseJob, contractType } from '../backend/supabase/functions/sync-career-offers/index.ts';

const job={ '@type':'JobPosting',title:'Stage data analyst',hiringOrganization:{name:'Entreprise exemple'},description:'Compétences : Python, SQL et Excel.',employmentType:'FULL_TIME',datePosted:'2026-10-03',validThrough:'2026-10-20',jobLocation:{address:{addressLocality:'Marrakech',addressCountry:'MA'}} };
const html=j=>`<script type="application/ld+json">${JSON.stringify(j)}</script>`;
test('respecte les règles robots spécifiques, les jokers et les exceptions',()=>{
  assert.equal(allowedByRobots('User-agent: *\nDisallow: /offre/', 'https://example.org/offre/test'),false);
  assert.equal(allowedByRobots('User-agent: *\nDisallow: /*keyword\nAllow: /job/', 'https://example.org/jobs?keyword=data'),false);
  assert.equal(allowedByRobots('User-agent: *\nDisallow: /\nAllow: /job/', 'https://example.org/job/5/'),true);
  assert.equal(allowedByRobots('User-agent: MarrakechCareerBot\nDisallow: /\nUser-agent: *\nAllow: /', 'https://example.org/job/5/'),false);
});
test('ignore les liens externes et dédoublonne JobSquare sous la forme déjà importée',()=>{
  assert.equal(canonicalUrl('https://evil.test/job/5/x/','https://www.jobsquare.ma'),null);
  assert.equal(canonicalUrl('https://user:password@www.jobsquare.ma/job/5/x/','https://www.jobsquare.ma'),null);
  assert.deepEqual(jobLinks('<a href="/job/5/x/?ref=1"></a><a href="/job/5/x/"></a><a href="https://evil.test/job/6/y/"></a>',SOURCES[0]),['https://jobsquare.ma/job/5/x/']);
});
test('lit les graphes JSON-LD et répare uniquement les caractères de contrôle dans les chaînes',()=>{
  assert.equal(jsonLdJobs(html({'@graph':[job]})).length,1);
  assert.equal(jsonLdJobs('<script type="application/ld+json">{"@type":"JobPosting","description":"ligne 1\nligne 2"}</script>')[0].description,'ligne 1\nligne 2');
  assert.equal(jsonLdJobs('<script type="application/ld+json">invalid</script>').length,0);
});
test('filtre Marrakech et respecte la date d’expiration et les stages à temps plein',()=>{
  const parsed=parseJob(html(job),'https://joobaz.com/job/test','joobaz',Date.parse('2026-10-04'));
  assert.equal(parsed.contract_type,'internship'); assert.equal(parsed.status,'verified');
  assert.deepEqual(parsed.skills,['Python','SQL','Excel']);
  assert.ok(!parsed.description.includes('Compétences :'));
  assert.equal(parseJob(html({...job,validThrough:'2026-09-30'}),'https://joobaz.com/job/test','joobaz',Date.parse('2026-10-04')).status,'closed');
  assert.equal(parseJob(html({...job,jobLocation:{address:{addressLocality:'Casablanca'}}}),'https://joobaz.com/job/test','joobaz'),null);
  assert.equal(contractType('FULL_TIME','Commercial'),'full_time');
  assert.equal(contractType('','Commercial'),null);
});
