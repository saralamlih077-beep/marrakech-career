import type { Company } from './types';

export type CompanyActivityPage = { title: string; description: string; headings: string; text: string; sourceUrl: string };
export type CompanyActivityIndex = Record<string, CompanyActivityPage>;
export type CompanySearchEvidence = { label: string; excerpt: string; sourceUrl?: string };

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const stopWords = new Set(('a au aux avec de des du d en et la le les l un une pour dans entreprise entreprises societe societes company companies the and of in ' +
  'je j me moi mon ma mes tu vous votre vos nous notre nos il elle ils elles ce ces c est sont etre qui que quoi quel quelle quels quelles qu ' +
  'cherche chercher recherches recherche rechercher trouve trouver veux veut voudrais souhaite souhaites souhaitons besoin aimerais pouvez peux peut ' +
  'fait font faire travaille travaillent travail travaillent specialise specialisee specialises specialisees specialisees domaine secteur activite activites ' +
  'stage stages stagiaire stagiaires emploi emplois job jobs offre offres candidature candidatures recrute recrutent recruter recrutement recruteur recruteurs ' +
  'suis sommes etudiant etudiante etudiants etudiantes student students junior senior debutant debutante tant comment ne n mais but propose proposent proposant proposez proposant fournit fournissent fournisse provide provides providing ' +
  'svp bonjour merci s il plait please looking look search find want need related involved specializing specialise specializes specialize internship internships for to i am is are that which an').split(/\s+/));

// Specific service synonyms, rather than treating all IT companies as AI or infrastructure providers.
const concepts = [
  { label: 'Intelligence artificielle', aliases: ['ia', 'ai', 'intelligence artificielle', 'intelligence artificiel', 'artificial intelligence', 'intelligenceartificielle', 'ia generative', 'generative ai'], related: ['machine learning', 'apprentissage automatique', 'deep learning', 'apprentissage profond', 'llm', 'vision par ordinateur', 'computer vision'] },
  { label: 'Machine learning', aliases: ['machine learning', 'apprentissage automatique', 'deep learning', 'apprentissage profond'] },
  { label: 'Agents conversationnels', aliases: ['chatbot', 'chatbots', 'agent conversationnel', 'agents conversationnels'] },
  { label: 'Infrastructure informatique', aliases: ['infrastructure', 'infrastructures', 'infrastructure informatique', 'infrastructures informatiques', 'infrastructure it', 'it infrastructure', 'infra'], related: ['serveur', 'serveurs', 'server', 'servers', 'reseau informatique', 'reseaux informatiques', 'reseaux', 'reseau', 'network', 'networks', 'networking', 'datacenter', 'data center', 'data centre', 'centre de donnees', 'centres de donnees', 'administration systeme', 'administration systemes', 'system administration', 'infogerance', 'virtualisation', 'virtualization', 'devops', 'cloud'] },
  { label: 'Réseaux informatiques', aliases: ['reseau informatique', 'reseaux informatiques', 'reseaux', 'reseau', 'network', 'networks', 'networking'] },
  { label: 'Serveurs et datacenters', aliases: ['serveur', 'serveurs', 'server', 'servers', 'datacenter', 'datacenters', 'data center', 'data centre', 'centre de donnees', 'centres de donnees'] },
  { label: 'Cloud', aliases: ['cloud', 'cloud computing'] },
  { label: 'Virtualisation', aliases: ['virtualisation', 'virtualization'] },
  { label: 'Administration systèmes', aliases: ['administration systeme', 'administration systemes', 'system administration', 'infogerance', 'devops'] },
  { label: 'Développement web et applications', aliases: ['developpement web', 'web development', 'developpeur web', 'developpeurs web', 'site web', 'sites web', 'site internet', 'sites internet', 'creation de site', 'creation de sites', 'application mobile', 'applications mobiles', 'mobile development', 'software development', 'developpement logiciel', 'developpement logiciels'] },
  { label: 'Cybersécurité', aliases: ['cybersecurite', 'cybersecurity', 'cyber security', 'securite informatique', 'it security', 'securite reseau', 'pentest', 'firewall', 'pare feu'] },
  { label: 'Données et analyse', aliases: ['data', 'donnees', 'data science', 'science des donnees', 'analyse de donnees', 'data analytics', 'business intelligence', 'bi', 'power bi', 'big data'] },
  { label: 'Marketing et référencement', aliases: ['marketing digital', 'digital marketing', 'seo', 'referencement', 'referencement naturel', 'search engine optimization'] },
  { label: 'Comptabilité', aliases: ['comptabilite', 'accounting', 'comptable', 'comptables', 'expert comptable', 'expertise comptable', 'fiduciaire'] },
  { label: 'Hôtellerie', aliases: ['hotellerie', 'hospitality', 'hotel', 'hotels', 'hotelier', 'hoteliere'] },
  { label: 'Développement informatique', aliases: ['developpeur', 'developpeurs', 'developer', 'developers', 'developpement informatique', 'programmation', 'programming', 'software engineering', 'ingenierie logicielle'], related: ['developpement web', 'web development', 'developpement logiciel', 'software development', 'application mobile', 'applications mobiles'] },
  { label: 'Marketing', aliases: ['marketing', 'communication', 'publicite', 'advertising'], related: ['marketing digital', 'digital marketing', 'seo', 'referencement', 'reseaux sociaux', 'social media'] },
  { label: 'Architecture et construction', aliases: ['architecture', 'architecte', 'architectes', 'construction', 'batiment', 'btp', 'genie civil', 'civil engineering'] },
  { label: 'Santé', aliases: ['sante', 'healthcare', 'medical', 'medecine', 'clinique', 'cliniques', 'hospital', 'hopital', 'hopitaux'] },
  { label: 'Éducation et formation', aliases: ['education', 'enseignement', 'formation', 'formations', 'training', 'ecole', 'ecoles'] },
  { label: 'Finance et assurance', aliases: ['finance', 'financier', 'financial', 'banque', 'banques', 'bank', 'banking', 'assurance', 'assurances', 'insurance'] },
  { label: 'Logistique et transport', aliases: ['logistique', 'logistics', 'transport', 'transports', 'transportation', 'supply chain'] },
  { label: 'Immobilier', aliases: ['immobilier', 'immobiliere', 'immobilieres', 'real estate'] },
  { label: 'Tourisme', aliases: ['tourisme', 'tourism', 'travel', 'voyage', 'voyages', 'agence de voyage', 'agence de voyages'] },
  { label: 'Informatique', aliases: ['informatique', 'informatiques', 'it', 'information technology'] },
  { label: 'Restauration', aliases: ['restauration', 'restaurant', 'restaurants', 'catering', 'gastronomie'] },
];
const aliases = concepts.flatMap(concept => concept.aliases.map(alias => ({ concept, words: normalize(alias).split(' ') })))
  .sort((a, b) => b.words.length - a.words.length);
type Unit = { label: string; terms: string[]; concept?: string; patterns?: RegExp[] };

export type CompanySearchAnalysis = {
  criteria: string[]; excluded: string[]; corrections: { from: string; to: string }[];
  groups: Unit[][]; excludedUnits: Unit[]; recruitment: boolean;
};

// Interpret the request locally: no API key, login, or network call per keystroke.
const arabicActivities: [RegExp, string][] = [
  [/الذكاء\s+(?:الاصطناعي|الإصطناعي)/g, ' intelligence artificielle '],
  [/البنية\s+التحتية/g, ' infrastructure '], [/تطوير\s+(?:الويب|المواقع)/g, ' developpement web '],
  [/الأمن\s+السيبراني|الامن\s+السيبراني/g, ' cybersecurite '],
  [/المحاسبة/g, ' comptabilite '], [/التسويق/g, ' marketing '], [/الفنادق/g, ' hotellerie '],
];
const vocabularyCache = new WeakMap<CompanySearchDocument[], Set<string>>();
function vocabulary(documents: CompanySearchDocument[]): Set<string> {
  let words = vocabularyCache.get(documents);
  if (!words) {
    words = new Set(aliases.flatMap(alias => alias.words));
    for (const { fields } of documents) for (const field of fields) {
      // Body text is excluded from typo suggestions to avoid guessing from arbitrary prose.
      if (field.weight >= 4) for (const word of field.normalized.split(' ')) if (word.length >= 3) words.add(word);
    }
    vocabularyCache.set(documents, words);
  }
  return words;
}

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

export function analyzeCompanySearch(query: string, documents: CompanySearchDocument[]): CompanySearchAnalysis {
  const original = query.slice(0, 300);
  const translated = arabicActivities.reduce((text, [pattern, value]) => text.replace(pattern, value), original);
  const raw = normalize(translated);
  const words = vocabulary(documents);
  const corrections: CompanySearchAnalysis['corrections'] = [];
  const corrected = raw.split(' ').map(word => {
    // Keep known words, short acronyms and intentional prefixes unchanged.
    if (word.length < 5 || stopWords.has(word) || words.has(word) || [...words].some(candidate => candidate.startsWith(word))) return word;
    const limit = word.length >= 9 ? 2 : 1;
    let distance = limit + 1;
    let suggestions: string[] = [];
    for (const candidate of words) {
      if (stopWords.has(candidate) || Math.abs(candidate.length - word.length) > limit) continue;
      const current = editDistance(word, candidate);
      if (current < distance) { distance = current; suggestions = [candidate]; }
      else if (current === distance) suggestions.push(candidate);
    }
    if (distance <= limit && suggestions.length === 1) {
      corrections.push({ from: word, to: suggestions[0] });
      return suggestions[0];
    }
    return word;
  }).join(' ');
  const excludedUnits: Unit[] = [];
  const positive = corrected.replace(/\b(?:sans|sauf|hors|except|without|pas de|pas d|pas|ni)\s+(.+?)(?=\b(?:mais|but|avec)\b|$)/g, (_, text: string) => {
    excludedUnits.push(...queryUnits(text));
    return ' ';
  });
  const groups = positive.split(/\b(?:ou|or)\b/).map(text => queryUnits(text)).filter(group => group.length);
  // "Une agence qui fait de l'IA" describes a service rather than requiring the word agence.
  const companyTypes = new Set(['agence', 'agences', 'service', 'services', 'cabinet', 'cabinets', 'startup', 'startups', 'bureau', 'solution', 'solutions', 'fournisseur', 'fournisseurs']);
  for (let i = 0; i < groups.length; i++) if (groups[i].some(unit => unit.concept)) groups[i] = groups[i].filter(unit => !companyTypes.has(unit.label));
  return {
    criteria: [...new Set(groups.flatMap(group => group.map(unit => unit.label)))],
    excluded: [...new Set(excludedUnits.map(unit => unit.label))], corrections, groups, excludedUnits,
    recruitment: /\b(?:stages?|stagiaires?|emplois?|jobs?|internships?|recrut\w*|offres?|candidatures?)\b/.test(raw),
  };
}

function queryUnits(query: string): Unit[] {
  const words = normalize(query).split(' ').filter(Boolean);
  const units: Unit[] = [];
  for (let position = 0; position < words.length;) {
    const alias = aliases.find(item => item.words.every((word, offset) => words[position + offset] === word));
    if (alias) {
      if (!units.some(unit => unit.concept === alias.concept.label)) {
        units.push({ label: alias.concept.label, terms: [...alias.concept.aliases, ...('related' in alias.concept ? alias.concept.related || [] : [])].map(normalize), concept: alias.concept.label });
      }
      position += alias.words.length;
    } else {
      const word = words[position++];
      if (!stopWords.has(word) && !units.some(unit => unit.label === word)) units.push({ label: word, terms: [word] });
    }
  }
  return units;
}

function hit(text: string, unit: Unit): string | undefined {
  unit.patterns ??= unit.terms.map(term => new RegExp(`\\b${term.replace(/ /g, '\\s+')}${!unit.concept && term.length >= 3 ? '[a-z0-9]*' : ''}\\b`, 'g'));
  for (const pattern of unit.patterns) {
    for (const match of text.matchAll(pattern)) {
      const preceding = text.slice(Math.max(0, match.index! - 55), match.index);
      const following = text.slice(match.index! + match[0].length, match.index! + match[0].length + 25);
      // French "j'ai" is a verb, not the English acronym AI.
      if (match[0] === 'ai') {
        if (/\b(?:j|je(?:\s+(?:les|le|la|l|en|vous|me|m|leur))?)\s+$/.test(preceding)) continue;
        const context = text.slice(Math.max(0, match.index! - 100), match.index! + match[0].length + 100);
        if (!/\b(?:artificial|intelligence|generative|machine|learning|llm|agents?|chatbots?|apps?|tools?|outils?|automations?|automatisation|technology|technologie|digital|digitale|development|developpement|agency|design|solutions?|software|seo)\b/.test(context)) continue;
      }
      if (/^(?:reseaux?|networks?)$/.test(match[0]) && (/^\s+so(?:cial|ciaux)/.test(following) || /\bsocial\s+$/.test(preceding))) continue;
      if (/^(?:reseaux?|networks?|networking|serveurs?|servers?)$/.test(match[0])) {
        const context = text.slice(Math.max(0, match.index! - 140), match.index! + match[0].length + 140);
        if (!/\b(?:informatique|informatiques|it|telecom|telecoms|telecommunications|cybersecurite|ethernet|wifi|wi fi|routeur|routeurs|router|switch|commutateur|lan|wan|wlan|ip|firewall|network security|cloud|infrastructure|infrastructures|linux|windows|hebergement)\b/.test(context)) continue;
      }
      if (!/\b(?:sans|pas de|pas d|aucun|aucune|no|not|without)\s+(?:[a-z]+\s+){0,2}$/.test(preceding)) return match[0];
    }
  }
  return undefined;
}

export function companyWebsiteKey(raw: string | null): string {
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

type Field = { text: string; normalized: string; weight: number; sourceUrl?: string };
export type CompanySearchDocument = { company: Company; fields: Field[] };
const fieldHits = new WeakMap<Field, Map<string, string | undefined>>();
function hitField(field: Field, unit: Unit): string | undefined {
  let cache = fieldHits.get(field);
  if (!cache) { cache = new Map(); fieldHits.set(field, cache); }
  const key = unit.concept || unit.label;
  if (!cache.has(key)) {
    // Bound memory when users try many unrelated terms during a long session.
    if (cache.size >= 80) cache.clear();
    cache.set(key, hit(field.normalized, unit));
  }
  return cache.get(key);
}

export function buildCompanySearchDocuments(companies: Company[], pages: CompanyActivityIndex = {}): CompanySearchDocument[] {
  return companies.map(company => {
    const page = pages[companyWebsiteKey(company.site_web)];
    // This combined import label alone cannot prove an AI activity (e.g. a crèche labelled "IA & Data").
    const subdomain = normalize(company.sous_domaine || '') === 'ia data' ? '' : company.sous_domaine;
    const fields = [
      { text: company.nom, weight: 10 },
      { text: subdomain, weight: 7 }, { text: company.categorie, weight: 6 },
      { text: company.domaine, weight: 4 },
      { text: company.about_summary, weight: 7, sourceUrl: company.about_source_url || undefined },
      { text: company.adresse, weight: 2 },
      { text: page?.title, weight: 9, sourceUrl: page?.sourceUrl },
      { text: page?.description, weight: 8, sourceUrl: page?.sourceUrl },
      { text: page?.headings, weight: 7, sourceUrl: page?.sourceUrl },
      { text: page?.text, weight: 3, sourceUrl: page?.sourceUrl },
    ].filter((field): field is { text: string; weight: number; sourceUrl?: string } => Boolean(field.text?.trim()))
      .map(field => ({ ...field, normalized: normalize(field.text.replace(/https?:\/\/\S+|www\.\S+|\b\S+@\S+\b/gi, ' ')) }));
    return { company, fields };
  });
}

function excerpt(text: string, unit: Unit): string {
  const section = text.split(' · ').find(part => hit(normalize(part), unit)) || text;
  const matched = hit(normalize(section), unit) || '';
  const position = normalize(section).indexOf(matched);
  const start = Math.max(0, position - 60);
  const preview = section.slice(start, start + 210).trim().split(/\s+/).slice(0, 24).join(' ');
  return `${start ? '…' : ''}${preview}${section.length > start + preview.length ? '…' : ''}`;
}

type CompanySearchResult = { company: Company; score: number; evidence?: CompanySearchEvidence; missing: string[] };

export function runCompanySearch(documents: CompanySearchDocument[], query: string, domain = 'All'): { analysis: CompanySearchAnalysis; results: CompanySearchResult[]; related: CompanySearchResult[] } {
  const analysis = analyzeCompanySearch(query, documents);
  const candidates = documents.filter(({ company }) => company.is_active !== false && (domain === 'All' || company.domaine === domain));
  const results: CompanySearchResult[] = [];
  const related: CompanySearchResult[] = [];
  if (!analysis.groups.length && !analysis.excludedUnits.length) {
    return { analysis, results: query.trim() ? [] : candidates.map(({ company }) => ({ company, score: 0, missing: [] })), related };
  }
  for (const { company, fields } of candidates) {
    if (analysis.excludedUnits.some(unit => fields.some(field => hitField(field, unit)))) continue;
    if (!analysis.groups.length) { results.push({ company, score: 0, missing: [] }); continue; }
    // Each OR branch is independent. Within a branch, all criteria give a full match.
    const groups = analysis.groups.map(units => {
      const matches = units.map(unit => {
        const field = fields.filter(field => hitField(field, unit)).sort((a, b) => b.weight - a.weight)[0];
        return field ? { unit, field } : null;
      });
      const valid = matches.filter((match): match is NonNullable<typeof match> => Boolean(match));
      return { valid, coverage: valid.length / units.length, missing: units.filter((_, i) => !matches[i]).map(unit => unit.label) };
    }).sort((a, b) => b.coverage - a.coverage || b.valid.length - a.valid.length);
    const { valid, coverage, missing } = groups[0];
    if (!valid.length || coverage < 0.5) continue;
    const best = [...valid].sort((a, b) => Number(Boolean(b.field.sourceUrl)) - Number(Boolean(a.field.sourceUrl)) || b.field.weight - a.field.weight)[0];
    const score = coverage * 100 + valid.reduce((sum, match) => sum + match.field.weight, 0) + (normalize(company.nom) === normalize(query) ? 30 : 0);
    const result = { company, score, missing, evidence: { label: best.unit.label, excerpt: excerpt(best.field.text, best.unit), sourceUrl: best.field.sourceUrl } };
    (missing.length ? related : results).push(result);
  }
  const order = (a: CompanySearchResult, b: CompanySearchResult) => b.score - a.score || a.company.nom.localeCompare(b.company.nom, 'fr') || a.company.id - b.company.id;
  return { analysis, results: results.sort(order), related: results.length ? [] : related.sort(order).slice(0, 24) };
}

export function searchCompanyDocuments(documents: CompanySearchDocument[], query: string, domain = 'All') {
  return runCompanySearch(documents, query, domain).results;
}
