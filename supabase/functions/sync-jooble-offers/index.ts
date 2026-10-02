import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type JoobleJob = {
  title?: string;
  company?: string;
  location?: string;
  link?: string;
  snippet?: string;
  type?: string;
  updated?: string;
};

const clean = (value: unknown) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim();

function contractType(value: string): 'internship' | 'cdi' | 'cdd' | 'freelance' {
  const text = value.toLowerCase();
  if (text.includes('stage') || text.includes('intern')) return 'internship';
  if (text.includes('freelance') || text.includes('contract')) return 'freelance';
  if (text.includes('cdd') || text.includes('temporary') || text.includes('temporaire')) return 'cdd';
  return 'cdi';
}

function extractSkills(text: string) {
  const dictionary = [
    'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Excel', 'Power BI', 'SEO',
    'Marketing digital', 'Intelligence artificielle', 'Data science', 'Français', 'Anglais', 'Arabe',
    'Communication', 'Vente', 'Comptabilité', 'Gestion', 'Hôtellerie', 'Accueil', 'Réservation',
  ];
  const normalized = text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return dictionary.filter((skill) => normalized.includes(skill.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
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
    const apiKey = Deno.env.get('JOOBLE_API_KEY');
    if (!apiKey) return Response.json({ error: 'La clé JOOBLE_API_KEY est manquante.' }, { status: 500, headers });

    const body = await request.json().catch(() => ({}));
    const requestedKeywords = Array.isArray(body?.keywords) ? body.keywords : [body?.keywords ?? ''];
    const keywords = requestedKeywords.map(clean).slice(0, 5);
    const location = clean(body?.location || 'Marrakech, Maroc');
    const startedAt = new Date().toISOString();
    const offers = new Map<string, JoobleJob>();

    for (const keyword of keywords) {
      const response = await fetch(`https://jooble.org/api/${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keyword, location, page: 1, ResultOnPage: 50 }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(clean(payload?.message || payload?.error || `Jooble a répondu ${response.status}.`));
      for (const job of Array.isArray(payload?.jobs) ? payload.jobs : []) {
        const url = clean(job?.link);
        if (url) offers.set(url, job);
      }
    }

    let imported = 0;
    let skipped = 0;
    for (const job of offers.values()) {
      const title = clean(job.title);
      const sourceUrl = clean(job.link);
      if (!title || !sourceUrl) { skipped += 1; continue; }
      const companyName = clean(job.company) || 'Entreprise via Jooble';
      const { data: company } = await service.from('entreprises').select('id').ilike('nom', companyName).limit(1).maybeSingle();
      const description = clean(job.snippet) || 'Description disponible sur le site de l’employeur.';
      const { error } = await service.from('job_offers').upsert({
        entreprise_id: company?.id ?? null,
        title,
        contract_type: contractType(clean(job.type)),
        location: clean(job.location) || 'Marrakech, Maroc',
        description,
        requirements: '',
        skills: extractSkills(`${title} ${description}`),
        source_url: sourceUrl,
        source_name: 'jooble',
        source_external_id: sourceUrl,
        published_at: job.updated ? new Date(job.updated).toISOString() : null,
        last_seen_at: startedAt,
        status: 'verified',
      }, { onConflict: 'source_url' });
      if (error) throw error;
      imported += 1;
    }

    return Response.json({ imported, skipped, discovered: offers.size, location, startedAt }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Import Jooble impossible.' }, { status: 500, headers });
  }
});
