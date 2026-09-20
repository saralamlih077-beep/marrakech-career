import { createClient } from 'npm:@supabase/supabase-js@2';

const JOBSQUARE_URL = 'https://www.jobsquare.ma/cities/jobs-in-Marrakech/';
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type ParsedOffer = {
  url: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  contractType: 'internship' | 'cdi' | 'cdd' | 'freelance';
  description: string;
  requirements: string;
  skills: string[];
  expiresAt: string | null;
};

const clean = (value: string) => value
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#(?:x)?[0-9a-f]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const absolute = (value: string) => new URL(value, JOBSQUARE_URL).toString().split('?')[0];
const capture = (html: string, pattern: RegExp) => clean(html.match(pattern)?.[1] || '');

function contractType(value: string): ParsedOffer['contractType'] {
  const text = value.toLowerCase();
  if (text.includes('stage')) return 'internship';
  if (text.includes('freelance') || text.includes('indépendant')) return 'freelance';
  if (text.includes('cdd') || text.includes('temporaire')) return 'cdd';
  return 'cdi';
}

function toDate(value: string): string | null {
  const match = value.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59.999Z`).toISOString();
}

function extractSkills(text: string) {
  const dictionary = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Excel', 'Power BI', 'SEO',
    'Réseaux sociaux', 'Marketing digital', 'Intelligence artificielle', 'Data science', 'Automatisation',
    'Français', 'Anglais', 'Arabe', 'Communication', 'Organisation', 'Rédaction', 'Relation client',
    'Vente', 'Comptabilité', 'Gestion', 'Hôtellerie', 'Cuisine', 'Massage', 'Accueil', 'Réservation',
  ];
  const normalized = text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return dictionary.filter((skill) => normalized.includes(skill.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
}

function parseOffer(html: string, url: string): ParsedOffer | null {
  const externalId = url.match(/\/job\/(\d+)\//)?.[1];
  const title = capture(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!externalId || !title) return null;
  const company = capture(html, /href=["'][^"']*\/company\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) || 'Entreprise JobSquare';
  const visible = clean(html);
  const description = capture(html, /Description de l'emploi[\s\S]*?<\/h2>([\s\S]*?)(?=<h2|<div[^>]+class=["'][^"']*(?:job|listing)[^"']*footer|$)/i) || visible.slice(0, 1800);
  const requirements = capture(html, /Exigences de l'emploi[\s\S]*?<\/h2>([\s\S]*?)(?=<h2|<div[^>]+class=["'][^"']*(?:job|listing)[^"']*footer|$)/i);
  const expiryText = visible.match(/Expire le\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i)?.[1] || '';
  const location = visible.match(/·\s*([^·]{2,80}(?:Marrakech|Marrakesh)[^·]{0,40})\s*·/i)?.[1]?.trim() || 'Marrakech, Maroc';
  const typeText = visible.match(/(?:Type de contrat|TYPE D'EMPLOI DÉSIRÉ)\s*([^·]{2,50})/i)?.[1] || visible;
  const allText = `${title} ${description} ${requirements}`;
  return { url, externalId, title, company, location, contractType: contractType(typeText), description: description.slice(0, 8000), requirements: requirements.slice(0, 4000), skills: extractSkills(allText), expiresAt: toDate(expiryText) };
}

async function pageOfferUrls(page: number) {
  const url = page === 1 ? JOBSQUARE_URL : `${JOBSQUARE_URL}?action=search&page=${page}`;
  const response = await fetch(url, { headers: { 'user-agent': 'Marrakech-Career/1.0 (job listings sync; contact: admin@marrakech-career.local)' } });
  if (!response.ok) throw new Error(`JobSquare a répondu ${response.status} pour la page ${page}.`);
  const html = await response.text();
  return [...new Set([...html.matchAll(/href=["']([^"']*\/job\/\d+\/[^"'#?]+)["']/gi)].map((match) => absolute(match[1])))];
}

async function isAllowed(request: Request, service: ReturnType<typeof createClient>) {
  const cronSecret = Deno.env.get('JOBSQUARE_SYNC_SECRET');
  if (cronSecret && request.headers.get('x-cron-secret') === cronSecret) return true;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data: { user } } = await service.auth.getUser(token);
  const allowed = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map((email) => email.trim().toLowerCase());
  return Boolean(user?.email && allowed.includes(user.email.toLowerCase()));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    if (!await isAllowed(request, service)) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    const startedAt = new Date().toISOString();
    const allUrls = new Set<string>();
    // The public Marrakech listing currently spans several pages. Stop when a page is empty.
    for (let page = 1; page <= 12; page += 1) {
      const urls = await pageOfferUrls(page);
      if (!urls.length) break;
      urls.forEach((url) => allUrls.add(url));
      if (urls.length < 10) break;
    }
    let imported = 0;
    let skipped = 0;
    for (const url of allUrls) {
      const response = await fetch(url, { headers: { 'user-agent': 'Marrakech-Career/1.0 (job listings sync)' } });
      if (!response.ok) { skipped += 1; continue; }
      const offer = parseOffer(await response.text(), url);
      if (!offer) { skipped += 1; continue; }
      const { data: company } = await service.from('entreprises').select('id').ilike('nom', offer.company).limit(1).maybeSingle();
      const { error } = await service.from('job_offers').upsert({
        entreprise_id: company?.id ?? null,
        title: offer.title,
        contract_type: offer.contractType,
        location: offer.location,
        description: offer.description || 'Description disponible sur la source.',
        requirements: offer.requirements,
        skills: offer.skills,
        source_url: offer.url,
        source_name: 'jobsquare',
        source_external_id: offer.externalId,
        expires_at: offer.expiresAt,
        last_seen_at: startedAt,
        status: 'verified',
      }, { onConflict: 'source_url' });
      if (error) throw error;
      imported += 1;
    }
    // Do not remove data. Offers absent from a completed import are simply closed and hidden.
    await service.from('job_offers').update({ status: 'closed' })
      .eq('source_name', 'jobsquare')
      .lt('last_seen_at', startedAt);
    await service.from('job_offers').update({ status: 'closed' })
      .eq('source_name', 'jobsquare')
      .lte('expires_at', new Date().toISOString());
    return Response.json({ imported, skipped, discovered: allUrls.size, startedAt }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Import JobSquare impossible.' }, { status: 500, headers });
  }
});
