import { load } from 'cheerio';

const clean = (text        ) => text.replace(/\s+/g, ' ').trim();
const normalized = (text        ) => clean(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
const monthNames = ['janvier|january|janv|jan', 'fevrier|february|fevr|feb', 'mars|march|mar', 'avril|april|avr', 'mai|may', 'juin|june|jun', 'juillet|july|jul', 'aout|august|aug', 'septembre|september|sept|sep', 'octobre|october|oct', 'novembre|november|nov', 'decembre|december|dec'];
const monthPattern = `(${monthNames.join('|')})\\.?`;
const iso = (day        , month        , year        ) => {
  const number = monthNames.findIndex(names => names.split('|').includes(month)) + 1;
  const value = `${year}-${String(number).padStart(2, '0')}-${day.padStart(2, '0')}`;
  return number && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
};

/** Only explicit source dates; never guess an edition from today's year or a URL. */
export function parseDateRange(input        )                                                {
  const text = normalized(input).replace(/[,]/g, ' ').replace(/\s+/g, ' ');
  const singles = [...text.matchAll(new RegExp(`(\\d{1,2})\\s+${monthPattern}\\s+(20\\d{2})`, 'g'))];
  const fullyDated = singles.length >= 2 ? [iso(singles[0][1], singles[0][2], singles[0][3]), iso(singles[1][1], singles[1][2], singles[1][3])] : null;
  const cross = text.match(new RegExp(`(\\d{1,2})\\s+${monthPattern}\\s*(?:-|–|—|au|to)\\s*(\\d{1,2})\\s+${monthPattern}\\s+(20\\d{2})`));
  const shared = text.match(new RegExp(`((?:\\d{1,2}\\s*(?:-|–|—|au|to|et|and)\\s*)*\\d{1,2})\\s+${monthPattern}\\s+(20\\d{2})`));
  const monthFirst = text.match(new RegExp(`${monthPattern}\\s+((?:\\d{1,2}\\s*(?:-|–|—|to|and)\\s*)*\\d{1,2})\\s+(20\\d{2})`));
  let dates                    = [];
  if (fullyDated) dates = fullyDated;
  else if (cross) dates = [iso(cross[1], cross[2], cross[5]), iso(cross[3], cross[4], cross[5])];
  else if (shared) dates = (shared[1].match(/\d{1,2}/g) || []).map(day => iso(day, shared[2], shared[3]));
  else if (monthFirst) dates = (monthFirst[2].match(/\d{1,2}/g) || []).map(day => iso(day, monthFirst[1], monthFirst[3]));
  if (!dates.length || dates.some(date => !date)) return null;
  const startDate = dates[0] , endDate = dates[dates.length - 1] ;
  return endDate >= startDate ? { startDate, endDate } : null;
}

export const EVENT_SOURCES = [
  { id: 'etudiant', label: "L'Étudiant marocain", url: 'https://www.etudiant.ma/forums-salons' },
  { id: 'gitex', label: 'GITEX Africa', url: 'https://gitexafrica.com/who-attends' },
  { id: 'siam', label: 'SIAM', url: 'https://www.salon-agriculture.ma/en/' },
  { id: 'logismed', label: 'Logismed', url: 'https://logismed.ma/' },
  { id: 'siema', label: 'Morocco SIEMA', url: 'https://www.siemamaroc.com/' },
  { id: 'airshow', label: 'Marrakech Air Show', url: 'https://marrakechairshow2026.com/' },
  { id: 'ctcim', label: 'Chambre turque de commerce au Maroc', url: 'https://ctcim.ma/fr/informations/salons' },
]         ;
                                                       
                                                                                                                         

const cityNames = ['Marrakech', 'Casablanca', 'Rabat', 'Tanger', 'Fès', 'Meknès', 'Agadir', 'El Jadida', 'Laayoune', 'Dakhla', 'Béni Mellal', 'Kenitra', 'Oujda', 'Tetouan', 'Essaouira', 'Safi', 'Nador', 'Ouarzazate'];
function moroccanCity(value        ) { return cityNames.find(city => normalized(city) === normalized(value)) || (normalized(value) === 'beni mellal' ? 'Béni Mellal' : null); }
function domainsFor(text        ) {
  const value = normalized(text);
  const rules                     = [
    [/digital|numerique|informatique|cyber|electronique|\bia\b|\bai\b|intelligence artificielle/, 'IT & Digital'],
    [/construction|batiment|immobilier|materiaux/, 'Immobilier & Construction'],
    [/aeronaut|aviation|logistique|transport|industri|automobile|textile|fabrication|automation/, 'Industrie & Logistique'],
    [/energie|renouvelable|environnement|electri|dechet|durabil/, 'Énergies & Environnement'],
    [/agric|agro|aliment/, 'Agriculture'], [/formation|etudiant|education|orientation/, 'Éducation & Formation'],
    [/commerce|distribution/, 'Commerce & Distribution'], [/sante|medical/, 'Santé'],
    [/touris|hotel/, 'Tourisme & Hôtellerie'], [/finance|assurance/, 'Finance & Assurance'],
    [/marketing|communication/, 'Marketing & Communication'], [/nettoyage|hygiene|securite au travail/, 'Services aux entreprises'],
  ];
  return rules.filter(([pattern]) => pattern.test(value)).map(([, domain]) => domain).filter((value, index, all) => all.indexOf(value) === index);
}
function safeLink(value        , base        ) {
  try { const url = new URL(value, base); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function makeEvent(source             , input                                                                                                                                                            , today        )                      {
  const range = parseDateRange(input.dates), city = moroccanCity(clean(input.city));
  if (!range || !city) return null;
  const topics = input.topics.map(clean).filter(Boolean).slice(0, 12);
  const title = clean(input.title);
  if (!title || /annul[eé]|cancelled|canceled/i.test(title + ' ' + input.dates)) return null;
  const domains = domainsFor(title + ' ' + topics.join(' '));
  return { id: `${source.id}-${normalized(title + '-' + city).replace(/[^a-z0-9]+/g, '-')}-${range.startDate}`, title, country: 'MA', city,
    venue: clean(input.venue) || 'Lieu à consulter sur le site officiel', ...range, domains: domains.length ? domains : ['Non classé'], topics,
    type: input.type || 'Salon', description: `${title} à ${city}. Consultez le programme publié pour préparer votre visite.`,
    learning: topics.length ? `Thèmes annoncés : ${topics.join(', ')}. Consultez le programme pour connaître les rencontres et conférences proposées.` : 'Consultez le programme de cette édition pour découvrir les métiers, les intervenants et les rencontres proposés.',
    organizer: input.organizer || "Organisateur et conditions à consulter sur le site de l’événement", price: "Tarifs et conditions d’accès à consulter sur le site officiel", sourceUrl: source.url,
    registrationUrl: input.registrationUrl || source.url, sourceName: source.label, verifiedAt: today, status: 'published' };
}

export function parseSource(source             , html        , today = moroccoToday())                 {
  const $ = load(html);
  $('script,style,nav,footer,header,noscript').remove();
  const rows                 = [];
  const add = (input                                 ) => { const row = makeEvent(source, input, today); if (row) rows.push(row); };
  if (source.id === 'etudiant') {
    $('h5').each((_, el) => {
      const heading = $(el), card = heading.parent();
      if (!/forum/i.test(heading.text())) return;
      const paragraphs = card.find('p');
      const location = paragraphs.eq(1), city = clean(location.find('span').last().text());
      const venue = clean(location.clone().find('span').remove().end().text()).replace(/\s*-\s*$/, '');
      add({ title: heading.text(), city, venue, dates: paragraphs.first().text(), topics: ['Orientation', 'Formation', 'Métiers'], type: 'Forum', organizer: "L'Étudiant marocain" });
    });
  } else if (source.id === 'ctcim') {
    $('h3').each((_, el) => {
      const heading = $(el), card = heading.parent(), top = card.children('div').first();
      const cityText = clean(top.find('span').first().text());
      if (!cityText.startsWith('🇲🇦')) return;
      const topics = card.children('div').eq(1).find('span').map((_, span) => clean($(span).text())).get();
      const registrationUrl = safeLink(card.children('a').attr('href') || '', source.url);
      if (!registrationUrl) return;
      add({ title: heading.text(), city: cityText.replace('🇲🇦', '').trim(), venue: card.children('p').first().text(), dates: top.children('span').last().text(), topics, registrationUrl });
    });
  } else {
    // Visible announcements win over stale HTML titles and structured metadata.
    const body = clean($('body').text());
    if (source.id === 'gitex') {
      const date = body.match(/\d{1,2}\s*[-–—]\s*\d{1,2}\s+(?:April|Avril)\s+20\d{2}/i)?.[0];
      if (date && /Marrakech/i.test(body)) add({ title: 'GITEX Africa', city: 'Marrakech', venue: 'Lieu et accès à consulter sur le site officiel', dates: date, topics: ['Intelligence artificielle', 'Digital', 'Cybersécurité'], organizer: 'GITEX Africa' });
    } else if (source.id === 'siam') {
      const date = body.match(/DU\s+\d{1,2}\s+AU\s+\d{1,2}\s+AVRIL\s+20\d{2}/i)?.[0];
      if (date && /Mekn[eè]s/i.test(body)) add({ title: 'Salon international de l’agriculture au Maroc (SIAM)', city: 'Meknès', venue: 'Lieu et accès à consulter sur le site officiel', dates: date, topics: ['Agriculture', 'Agroalimentaire'], organizer: 'SIAM' });
    } else if (source.id === 'logismed') {
      const date = body.match(/\d{1,2}\s*[-–—]\s*\d{1,2}\s*[-–—]\s*\d{1,2}\s+Mai\s+20\d{2}/i)?.[0];
      if (date && /Casablanca/i.test(body)) add({ title: 'Logismed', city: 'Casablanca', venue: /Foire internationale de Casablanca/i.test(body) ? 'Foire internationale de Casablanca' : 'Lieu à consulter sur le site officiel', dates: date, topics: ['Logistique', 'Transport', 'Supply chain'], organizer: 'Logismed' });
    } else if (source.id === 'siema') {
      const banner = clean($('.banner-info').first().text());
      if (/Casablanca/i.test(banner)) add({ title: 'Morocco SIEMA', city: 'Casablanca', venue: /AMDIE\s*\(OFEC\)/i.test(banner) ? 'AMDIE (OFEC)' : 'Lieu à consulter sur le site officiel', dates: banner, topics: ['Agroalimentaire', 'Machines industrielles', 'Emballage'], organizer: 'Morocco SIEMA' });
    } else if (source.id === 'airshow') {
      const date = body.match(/OCTOBER\s+\d{1,2}\s*[-–—]\s*\d{1,2}\s*,?\s*20\d{2}/i)?.[0];
      if (date && /Marrakech/i.test(body)) add({ title: 'Marrakech Air Show', city: 'Marrakech', venue: 'Lieu et accès à consulter sur le site officiel', dates: date, topics: ['Aéronautique', 'Aviation'], organizer: 'Marrakech Air Show' });
    }
  }
  if (!rows.length) throw new Error('No valid dated Moroccan announcement');
  return deduplicateEvents(rows).filter(row => row.endDate >= today);
}

export function deduplicateEvents(events                )                 {
  const rows = new Map                      ();
  for (const row of events) {
    const host = new URL(row.registrationUrl || row.sourceUrl).hostname.replace(/^www\./, '');
    const key = `${host === 'etudiant.ma' ? normalized(row.title) : host}|${normalized(row.city)}|${row.startDate}`;
    const previous = rows.get(key);
    if (!previous || previous.sourceName === 'Chambre turque de commerce au Maroc') rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'fr'));
}

const BOT = 'MarrakechCareerEvents';
function selectedRobotsGroups(text        ) {
  const groups                                                                                   = [];
  let group                                   ;
  let hasRules = false;
  for (const line of text.split(/\r?\n/)) {
    const match = line.split('#')[0].trim().match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const [, rawKey, value] = match, key = rawKey.trim().toLowerCase();
    if (key === 'user-agent') {
      if (!group || hasRules) { group = { agents: [], rules: [], delay: 0 }; groups.push(group); hasRules = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && (key === 'allow' || key === 'disallow')) { group.rules.push({ allow: key === 'allow', path: value }); hasRules = true; }
    else if (group && key === 'crawl-delay' && /^\d+(\.\d+)?$/.test(value)) { group.delay = Number(value) * 1000; hasRules = true; }
  }
  const bot = BOT.toLowerCase();
  const specific = groups.filter(group => group.agents.some(agent => agent !== '*' && bot.includes(agent)));
  const maxAgent = Math.max(0, ...specific.flatMap(group => group.agents.filter(agent => agent !== '*' && bot.includes(agent)).map(agent => agent.length)));
  return maxAgent ? specific.filter(group => group.agents.some(agent => agent.length === maxAgent && bot.includes(agent))) : groups.filter(group => group.agents.includes('*'));
}
export function robotsDelay(text        ) { return Math.max(0, ...selectedRobotsGroups(text).map(group => group.delay)); }
export function robotsAllows(text        , pathname        )          {
  const selected = selectedRobotsGroups(text);
  const matches = selected.flatMap(group => group.rules).filter(rule => {
    if (!rule.path) return false;
    const pattern = rule.path.split('*').map(part => part.replace(/[.+?^{}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + pattern.replace(/\\\$$/, '$')).test(pathname);
  }).sort((a, b) => b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

const MAX_BYTES = 2_000_000;
async function fetchText(url        , signal             , fetcher              )                                            {
  const original = new URL(url); let current = original;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(current.href, { signal, redirect: 'manual', headers: { 'User-Agent': `${BOT}/1.0 (+https://marrakech-career.vercel.app/)`, Accept: 'text/html,text/plain;q=0.9' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = new URL(response.headers.get('location') || '', current);
      await response.body?.cancel();
      if (next.protocol !== 'https:' || next.username || next.password || next.hostname.replace(/^www\./, '') !== original.hostname.replace(/^www\./, '')) throw new Error('Unapproved redirect');
      current = next; continue;
    }
    if (!response.ok) { await response.body?.cancel(); return { status: response.status, text: '' }; }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Source too large'); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('Empty source');
    const chunks               = []; let size = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Source too large'); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { status: response.status, text: new TextDecoder().decode(bytes) };
  }
  throw new Error('Too many redirects');
}

export async function collectEvents(options                                                                           = {}) {
  const now = options.now || new Date(), today = moroccoToday(now), checkedAt = now.toISOString();
  const fetcher = options.fetcher || fetch;
  const results = await Promise.all((options.sources || EVENT_SOURCES).map(async source => {
    let events                 = [], status                         = 'unavailable';
    const signal = AbortSignal.timeout(24000);
    try {
      const url = new URL(source.url);
      const robots = await fetchText(new URL('/robots.txt', url).href, signal, fetcher);
      if (robots.status !== 404 && robots.status !== 410 && (robots.status !== 200 || !robotsAllows(robots.text, url.pathname))) throw new Error('Source not accessible to collector');
      const delay = robotsDelay(robots.text);
      if (delay > 10000) throw new Error('Source requires a longer collection window');
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const response = await fetchText(source.url, signal, fetcher);
      if (response.status !== 200) throw new Error('Source unavailable');
      events = parseSource(source, response.text, today); status = 'ok';
    } catch { /* Source health is reported; no fabricated announcements. */ }
    return { events, source: { id: source.id, label: source.label, status, count: events.length, checkedAt } };
  }));
  return { schemaVersion: 1, mode: 'automatic', checkedAt, events: deduplicateEvents(results.flatMap(result => result.events)), sources: results.map(result => result.source) };
}

export function moroccoToday(now = new Date())         {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
