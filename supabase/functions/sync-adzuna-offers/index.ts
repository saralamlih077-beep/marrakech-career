import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type AdzunaOffer = {
  id: string;
  title: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
};

type AdzunaResponse = { results?: AdzunaOffer[] };

const SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Excel', 'Power BI', 'Tableau',
  'SEO', 'Marketing digital', 'Intelligence artificielle', 'Data science', 'Machine learning',
  'Français', 'Anglais', 'Arabe', 'Communication', 'Vente', 'Comptabilité', 'Gestion',
  'Hôtellerie', 'Cuisine', 'Accueil', 'Réservation',
];

function plainText(value: string | undefined) {
  return (value || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x)?[0-9a-f]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractSkills(text: string) {
  const content = normalize(text);
  return SKILLS.filter((skill) => content.includes(normalize(skill)));
}

function contractType(value: string): 'internship' | 'cdi' | 'cdd' | 'freelance' {
  const text = normalize(value);
  if (text.includes('intern') || text.includes('stage') || text.includes('apprentice')) return 'internship';
  if (text.includes('contract') || text.includes('temporary') || text.includes('fixed')) return 'cdd';
  if (text.includes('freelance') || text.includes('contractor')) return 'freelance';
  return 'cdi';
}

async function isAllowed(request: Request, service: ReturnType<typeof createClient>) {
  const syncSecret = Deno.env.get('ADZUNA_SYNC_SECRET') || Deno.env.get('JOBSQUARE_SYNC_SECRET');
  if (syncSecret && request.headers.get('x-cron-secret') === syncSecret) return true;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data: { user } } = await service.auth.getUser(token);
  const allowed = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map((email) => email.trim().toLowerCase());
  return Boolean(user?.email && allowed.includes(user.email.toLowerCase()));
}

async function getPage(page: number, appId: string, appKey: string, country: string) {
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('where', 'Marrakech');
  url.searchParams.set('results_per_page', '50');
  url.searchParams.set('content-type', 'application/json');

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const reason = plainText(await response.text()).slice(0, 300);
    throw new Error(`Adzuna a répondu ${response.status}${reason ? ` : ${reason}` : ''}`);
  }
  return await response.json() as AdzunaResponse;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });

  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    if (!await isAllowed(request, service)) return Response.json({ error: 'Forbidden' }, { status: 403, headers });

    const appId = Deno.env.get('ADZUNA_APP_ID');
    const appKey = Deno.env.get('ADZUNA_APP_KEY');
    const country = Deno.env.get('ADZUNA_COUNTRY') || 'ma';
    if (!appId || !appKey) throw new Error('Les secrets ADZUNA_APP_ID et ADZUNA_APP_KEY sont requis.');

    const startedAt = new Date().toISOString();
    let imported = 0;
    let discovered = 0;
    for (let page = 1; page <= 10; page += 1) {
      const response = await getPage(page, appId, appKey, country);
      const offers = response.results || [];
      if (!offers.length) break;
      discovered += offers.length;

      for (const offer of offers) {
        const title = plainText(offer.title);
        if (!offer.id || !title) continue;
        const companyName = plainText(offer.company?.display_name);
        const { data: company } = companyName
          ? await service.from('entreprises').select('id').ilike('nom', companyName).limit(1).maybeSingle()
          : { data: null };
        const description = plainText(offer.description);
        const requirements = plainText(`${offer.category?.label || ''} ${description}`).slice(0, 4000);
        const { error } = await service.from('job_offers').upsert({
          entreprise_id: company?.id ?? null,
          title,
          contract_type: contractType(offer.contract_type || offer.category?.label || title),
          location: plainText(offer.location?.display_name) || 'Marrakech, Maroc',
          description: description || 'Description disponible sur la source Adzuna.',
          requirements,
          skills: extractSkills(`${title} ${description} ${requirements}`),
          source_url: offer.redirect_url || `https://www.adzuna.com/details/${offer.id}`,
          source_name: 'adzuna',
          source_external_id: String(offer.id),
          published_at: offer.created ? new Date(offer.created).toISOString() : null,
          last_seen_at: startedAt,
          status: 'verified',
        }, { onConflict: 'source_url' });
        if (error) throw error;
        imported += 1;
      }
      if (offers.length < 50) break;
    }

    await service.from('job_offers').update({ status: 'closed' })
      .eq('source_name', 'adzuna')
      .lt('last_seen_at', startedAt);

    return Response.json({ imported, discovered, country, startedAt }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Import Adzuna impossible.' }, { status: 500, headers });
  }
});
