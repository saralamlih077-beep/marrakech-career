import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompanySearchDocuments, searchCompanyDocuments, companyWebsiteKey, runCompanySearch } from '../frontend/src/app/companySearch.ts';

const company = (id, nom, extra = {}) => ({ id, nom, domaine: 'IT & Digital', sous_domaine: null, categorie: 'Services', site_web: null, adresse: 'Marrakech', ...extra });
const companies = [
  company(1, '212 Services', {site_web:'https://212.example/'}),
  company(2, 'MONARK IT', {sous_domaine:'IA & Data',site_web:'https://monark.example/'}),
  company(3, 'Fiduciaire Chifaa', {domaine:'Services aux entreprises',categorie:'Comptable'}),
  company(4, 'Nanny Agency', {sous_domaine:'IA & Data',categorie:'Crèche'}),
  company(5, 'Agence Élan', {sous_domaine:'Développement web & mobile'}),
  company(6, 'Atelier', {about_summary:"Nous ne proposons pas d’intelligence artificielle."}),
];
const page = (title, text = '') => ({title, description:'',headings:'',text,sourceUrl:'https://source.example/'});
const index = {'https://212.example/':page('Sécurité et Infrastructure IT','Gestion de serveurs et de réseaux informatiques.'),
  'https://monark.example/':page('Intelligence artificielle','Développement web et solutions de machine learning.')};
const documents = buildCompanySearchDocuments(companies, index);
const ids = query => searchCompanyDocuments(documents, query).map(row => row.company.id);

test('IA matches a real AI service, not fiduciaire, Chifaa or an ambiguous imported label', () => {
  assert.deepEqual(ids('IA'), [2]);
  assert.deepEqual(ids('intelligence artificielle'), [2]);
  assert.deepEqual(ids('ARTIFICIAL INTELLIGENCE'), [2]);
  assert.deepEqual(ids('machine learning'), [2]);
  assert.ok(!ids('IA').includes(4));
});

test('infrastructure searches website activities and service synonyms instead of every IT company', () => {
  assert.deepEqual(ids('infrastructure'), [1]);
  assert.deepEqual(ids('réseaux'), [1]);
  assert.deepEqual(ids('servers'), [1]);
  const [result] = searchCompanyDocuments(documents, 'infrastructure');
  assert.equal(result.evidence.sourceUrl,'https://source.example/');
  assert.match(result.evidence.excerpt,/Infrastructure/);
});

test('social networks do not become IT infrastructure, and cloud remains a specific service query', () => {
  const records = buildCompanySearchDocuments([
    company(30,'Agence marketing',{about_summary:'Gestion des réseaux sociaux et des social networks.'}),
    company(31,'CloudHost',{about_summary:'Cloud computing pour entreprises.'}),
    company(32,'ServeursTech',{about_summary:'Administration de serveurs informatiques.'}),
  ]);
  assert.deepEqual(searchCompanyDocuments(records,'infrastructure').map(row=>row.company.id).sort(),[31,32]);
  assert.deepEqual(searchCompanyDocuments(records,'cloud').map(row=>row.company.id),[31]);
});

test('supports accents, compatibility characters, surrounding spaces, names and typing prefixes', () => {
  assert.deepEqual(ids('  agence elan '), [5]);
  assert.deepEqual(ids('𝐌𝐎𝐍𝐀𝐑𝐊'), [2]);
  assert.deepEqual(ids('212 ser'), [1]);
  assert.deepEqual(ids('web').sort(), [2,5]);
});

test('requires all meaningful search terms and combines the selected domain', () => {
  assert.deepEqual(ids('entreprise IA à Marrakech'), [2]);
  assert.deepEqual(ids('IA infrastructure'), []);
  assert.deepEqual(searchCompanyDocuments(documents,'IA','Santé'), []);
  assert.deepEqual(searchCompanyDocuments(documents,'comptable','Services aux entreprises').map(row=>row.company.id), [3]);
});

test('empty searches restore catalog ordering and unavailable sites still allow catalog searches', () => {
  assert.deepEqual(ids(''), companies.map(row=>row.id));
  assert.deepEqual(ids('   '), companies.map(row=>row.id));
  assert.deepEqual(searchCompanyDocuments(buildCompanySearchDocuments(companies),'Élan').map(row=>row.company.id), [5]);
  assert.deepEqual(ids('zzzzaucune'), []);
});

test('does not turn a negative claim or a contact URL into a service', () => {
  const negatives = buildCompanySearchDocuments([company(10,'Sans service IA', {nom:'Atelier sans activité IA',about_summary:'Sans intelligence artificielle. Contact ia@example.test https://ia.example.'})]);
  assert.deepEqual(searchCompanyDocuments(negatives,'intelligence artificielle'), []);
  const testimonials=buildCompanySearchDocuments([company(11,'Clinique',{domaine:'Santé',about_summary:"J'ai reçu de très bons soins. Je les ai remerciés. Notre réseau de partenaires accompagne les patients."})]);
  assert.deepEqual(searchCompanyDocuments(testimonials,'IA'), []);
  assert.deepEqual(searchCompanyDocuments(testimonials,'infrastructure'), []);
});

test('exact names rank first and inactive companies are excluded', () => {
  const records = buildCompanySearchDocuments([company(20,'Agence MONARK'),company(21,'MONARK'),company(22,'MONARK bis',{is_active:false})]);
  assert.deepEqual(searchCompanyDocuments(records,'MONARK').map(row=>row.company.id),[21,20]);
});

test('website index keys drop query parameters and fragments and reject credential URLs', () => {
  assert.equal(companyWebsiteKey('https://MONARK.example/?campaign=1#services'),'https://monark.example/');
  assert.equal(companyWebsiteKey('https://secret:password@example.test'),'');
  assert.equal(companyWebsiteKey('javascript:alert(1)'), '');
});

test('extracts activities from French and English requests instead of requiring filler or recruitment claims', () => {
  for (const query of ['je cherche une entreprise pour un stage en IA à Marrakech', 'je veux une agence qui fait de l’intelligence artificielle', 'I am looking for companies related to artificial intelligence']) {
    const result = runCompanySearch(documents, query);
    assert.deepEqual(result.results.map(row => row.company.id), [2], query);
    assert.equal(result.related.length, 0);
  }
  assert.equal(runCompanySearch(documents, 'stage en IA').analysis.recruitment, true);
  assert.equal(runCompanySearch(documents, 'IA').analysis.recruitment, false);
  assert.deepEqual(ids('je cherche un stage'), []);
});

test('corrects a unique small typo while preserving exact names, prefixes and short acronyms', () => {
  assert.deepEqual(ids('infrastruture'), [1]);
  assert.deepEqual(ids('inteligence artificielle'), [2]);
  assert.deepEqual(ids('monrak'), [2]);
  assert.deepEqual(ids('212 ser'), [1]);
  assert.deepEqual(runCompanySearch(documents,'monrak').analysis.corrections, [{from:'monrak',to:'monark'}]);
  assert.deepEqual(ids('zzzzaucune'), []);
});

test('OR alternatives and exclusions preserve domains and exclude inactive records', () => {
  assert.deepEqual(ids('IA ou infrastructure').sort(), [1,2]);
  assert.deepEqual(ids('IA or infrastructure').sort(), [1,2]);
  assert.deepEqual(ids('web sans IA'), [5]);
  assert.deepEqual(ids('sans IA').sort(), [1,3,4,5,6]);
  assert.deepEqual(searchCompanyDocuments(documents,'IA ou comptabilité','Services aux entreprises').map(row=>row.company.id), [3]);
  assert.deepEqual(runCompanySearch(documents,'IA infrastructure','Santé').related, []);
});

test('labels partial matches separately and never claims they meet all criteria', () => {
  const result = runCompanySearch(documents,'IA infrastructure');
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.related.map(row=>row.company.id).sort(), [1,2]);
  assert.deepEqual(result.related.find(row=>row.company.id===1).missing,['Intelligence artificielle']);
  assert.deepEqual(result.related.find(row=>row.company.id===2).missing,['Infrastructure informatique']);
  assert.deepEqual(runCompanySearch(documents,'IA').related, []);
  assert.deepEqual(runCompanySearch(documents,'zzzzaucune').related, []);
});

test('understands common Arabic activity names using the same grounded service matches', () => {
  assert.deepEqual(ids('أبحث عن شركة في الذكاء الاصطناعي'), [2]);
  assert.deepEqual(ids('البنية التحتية'), [1]);
});
