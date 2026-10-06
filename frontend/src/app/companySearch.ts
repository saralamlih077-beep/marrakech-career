import type { Company } from './types';

export type CompanyActivityPage = { title: string; description: string; headings: string; text: string; sourceUrl: string };
export type CompanyActivityIndex = Record<string, CompanyActivityPage>;
export type CompanySearchEvidence = { label: string; excerpt: string; sourceUrl?: string };

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const stopWords = new Set(['a', 'au', 'aux', 'avec', 'de', 'des', 'du', 'd', 'en', 'et', 'la', 'le', 'les', 'l', 'un', 'une', 'pour', 'dans', 'entreprise', 'entreprises', 'societe', 'societes', 'company', 'companies', 'the', 'and', 'of', 'in']);

// Specific service synonyms, rather than treating all IT companies as AI or infrastructure providers.
const concepts = [
  { label: 'Intelligence artificielle', aliases: ['ia', 'ai', 'intelligence artificielle', 'artificial intelligence', 'intelligenceartificielle', 'ia generative', 'generative ai'], related: ['machine learning', 'apprentissage automatique', 'deep learning', 'apprentissage profond', 'llm', 'vision par ordinateur', 'computer vision'] },
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
];
const aliases = concepts.flatMap(concept => concept.aliases.map(alias => ({ concept, words: normalize(alias).split(' ') })))
  .sort((a, b) => b.words.length - a.words.length);
type Unit = { label: string; terms: string[]; concept?: string; patterns?: RegExp[] };

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

export function searchCompanyDocuments(documents: CompanySearchDocument[], query: string, domain = 'All') {
  const units = queryUnits(query);
  const candidates = documents.filter(({ company }) => company.is_active !== false && (domain === 'All' || company.domaine === domain));
  if (!units.length) return candidates.map(({ company }) => ({ company, score: 0, evidence: undefined as CompanySearchEvidence | undefined }));
  const results: { company: Company; score: number; evidence?: CompanySearchEvidence }[] = [];
  for (const { company, fields } of candidates) {
    const matches = units.map(unit => {
      const field = fields.filter(field => hit(field.normalized, unit)).sort((a, b) => b.weight - a.weight)[0];
      return field ? { unit, field } : null;
    });
    if (matches.some(match => !match)) continue;
    const valid = matches.filter((match): match is NonNullable<typeof match> => Boolean(match));
    const best = [...valid].sort((a, b) => Number(Boolean(b.field.sourceUrl)) - Number(Boolean(a.field.sourceUrl)) || b.field.weight - a.field.weight)[0];
    const score = valid.reduce((sum, match) => sum + match.field.weight, 0) + (normalize(company.nom) === normalize(query) ? 30 : 0);
    results.push({ company, score, evidence: { label: best.unit.label, excerpt: excerpt(best.field.text, best.unit), sourceUrl: best.field.sourceUrl } });
  }
  return results.sort((a, b) => b.score - a.score || a.company.nom.localeCompare(b.company.nom, 'fr') || a.company.id - b.company.id);
}
