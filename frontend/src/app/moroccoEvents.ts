export const EVENT_DOMAINS = ['IT & Digital', 'Services aux entreprises', 'Marketing & Communication', 'Immobilier & Construction', 'Tourisme & Hôtellerie', 'Commerce & Distribution', 'Santé', 'Éducation & Formation', 'Finance & Assurance', 'Industrie & Logistique', 'Énergies & Environnement', 'Agriculture'];
export type MoroccoEvent = {
  id: string; title: string; country: 'MA'; city: string; venue: string;
  startDate: string; endDate: string; domains: string[]; topics: string[];
  type: 'Salon' | 'Forum' | 'Conférence' | 'Atelier'; description: string;
  learning: string; organizer: string; price: string; sourceUrl: string;
  verifiedAt: string; status: 'published';
};
export type EventFilters = { query: string; domain: string; city: string; period: string };
export function moroccoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeEventUrl(value: unknown): boolean {
  try { const url = new URL(String(value)); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function parseEventCatalog(payload: unknown): MoroccoEvent[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { events?: unknown }).events)) throw new Error('Catalogue indisponible');
  const seen = new Set<string>();
  return (payload as { events: unknown[] }).events.filter((item): item is MoroccoEvent => {
    if (!item || typeof item !== 'object') return false;
    const row = item as MoroccoEvent;
    const strings = ['id', 'title', 'city', 'venue', 'description', 'learning', 'organizer', 'price'] as const;
    if (strings.some(key => typeof row[key] !== 'string' || !row[key].trim()) || row.country !== 'MA' || row.status !== 'published' || seen.has(row.id)) return false;
    if (!validDate(row.startDate) || !validDate(row.endDate) || row.endDate < row.startDate || !validDate(row.verifiedAt) || !safeEventUrl(row.sourceUrl)) return false;
    if (!['Salon', 'Forum', 'Conférence', 'Atelier'].includes(row.type) || !Array.isArray(row.domains) || !row.domains.length || row.domains.some(value => !EVENT_DOMAINS.includes(value)) || !Array.isArray(row.topics) || row.topics.some(value => typeof value !== 'string')) return false;
    seen.add(row.id);
    return true;
  });
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function currentEvents(events: MoroccoEvent[], today = moroccoToday()) {
  return events.filter(event => event.endDate >= today && event.verifiedAt <= today).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'fr'));
}
export function filterEvents(events: MoroccoEvent[], filters: EventFilters, today = moroccoToday()) {
  const days = filters.period === '30' ? 30 : filters.period === '90' ? 90 : null;
  const end = days === null ? null : new Date(Date.parse(today + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
  const terms = normalize(filters.query).split(' ').filter(Boolean);
  return currentEvents(events, today).filter(event => {
    if (filters.domain !== 'all' && !event.domains.includes(filters.domain) || filters.city !== 'all' && event.city !== filters.city || end && event.startDate > end) return false;
    const text = normalize([event.title, event.description, event.city, event.organizer, ...event.domains, ...event.topics].join(' '));
    return terms.every(term => term === 'ia' || term === 'ai' ? /\b(ia|ai)\b|intelligence artificielle/.test(text) : text.includes(term));
  });
}
export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
}
