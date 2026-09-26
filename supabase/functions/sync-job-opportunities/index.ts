import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const skillWords = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'Excel', 'Power BI',
  'SEO', 'Marketing digital', 'Data science', 'Intelligence artificielle', 'Français',
  'Anglais', 'Arabe', 'Communication', 'Gestion', 'Docker', 'Git', 'Java', 'PHP',
];

type SourceOffer = {
  id: string;
  title?: string;
  company?: string;
  city?: string;
  location?: string;
  description?: string;
  category?: string;
  employment_type?: string;
  apply_url?: string;
  posted_at?: string;
  expires_at?: string;
};

const clean = (value: string | undefined) =>
  (value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const normalized = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const extractSkills = (text: string) =>
  skillWords.filter((word) => normalized(text).includes(normalized(word)));

const contractType = (value: string | undefined): 'internship' | 'cdi' | 'cdd' | 'freelance' => {
  const text = normalized(value || '');
  if (text.includes('intern') || text.includes('stage')) return 'internship';
  if (text.includes('freelance') || text.includes('contract')) return 'freelance';
  if (text.includes('temporary') || text.includes('fixed') || text.includes('cdd')) return 'cdd';
  return 'cdi';
};

/**
 * Some partner APIs keep an offer in their feed after the employer has removed
 * its application page.  Oracle pages often still respond with HTTP 200, so we
 * also inspect their page text for their explicit "no longer available" notice.
 * A network error, 401 or 403 must not close an offer: it only means the remote
 * site did not let us check it.
 */
const isUnavailableApplication = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'Marrakech-Career/1.0 (offer validation)' },
    });

    if (response.status === 404 || response.status === 410) return true;
    if (!response.ok) return false;

    const page = (await response.text()).slice(0, 300_000).toLowerCase();
    return [
      'this job is no longer available',
      'this requisition is no longer available',
      "cette offre n'est plus disponible",
      'offre n’est plus disponible',
      'job no longer available',
    ].some((message) => page.includes(message));
  } catch {
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  }

  const syncSecret = Deno.env.get('ADZUNA_SYNC_SECRET') || Deno.env.get('JOBSQUARE_SYNC_SECRET');
  if (!syncSecret || req.headers.get('x-cron-secret') !== syncSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Configuration Supabase manquante.' }, { status: 500, headers });
  }

  try {
    // Public endpoint: one small, read-only request for offers tagged Morocco + Marrakech.
    const endpoint = new URL('https://api.jobopportunitiesapi.org/public/jobs');
    endpoint.searchParams.set('country', 'MA');
    endpoint.searchParams.set('q', 'Marrakech');
    endpoint.searchParams.set('limit', '50');
    endpoint.searchParams.set('include_description', 'true');

    const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Job Opportunities API a répondu ${response.status}: ${(await response.text()).slice(0, 240)}`);
    }

    const payload = await response.json() as { data?: SourceOffer[] };
    const offers = payload.data || [];
    const service = createClient(supabaseUrl, serviceKey);
    const started = new Date().toISOString();
    let imported = 0;

    for (const offer of offers) {
      const title = clean(offer.title);
      const companyName = clean(offer.company);
      if (!offer.id || !title || !companyName) continue;

      const { data: company } = await service
        .from('entreprises')
        .select('id')
        .ilike('nom', companyName)
        .limit(1)
        .maybeSingle();

      const description = clean(offer.description);
      const requirements = clean(`${offer.category || ''} ${description}`).slice(0, 4000);
      const sourceUrl = offer.apply_url || `https://jobopportunitiesapi.org/jobs/${offer.id}`;
      const expiredByDate = Boolean(
        offer.expires_at && !Number.isNaN(Date.parse(offer.expires_at)) && Date.parse(offer.expires_at) <= Date.now(),
      );
      const expired = expiredByDate || await isUnavailableApplication(sourceUrl);

      const record = {
        entreprise_id: company?.id || null,
        title,
        contract_type: contractType(offer.employment_type || offer.category),
        location: clean(offer.location || offer.city) || 'Marrakech, Maroc',
        description: description || 'Description disponible sur la source originale.',
        requirements,
        skills: extractSkills(`${title} ${description} ${requirements}`),
        source_url: sourceUrl,
        source_name: 'job_opportunities_api',
        source_external_id: offer.id,
        // The database requires a date.  If the source does not provide one,
        // record the time when the offer was first synchronised.
        published_at: offer.posted_at || started,
        expires_at: offer.expires_at || null,
        last_seen_at: started,
        status: expired ? 'closed' : 'verified',
      };

      // source_url has no UNIQUE constraint in this database.  Do an explicit
      // lookup by source + external ID instead of PostgreSQL ON CONFLICT.
      const { data: existing, error: lookupError } = await service
        .from('job_offers')
        .select('id')
        .eq('source_name', 'job_opportunities_api')
        .eq('source_external_id', offer.id)
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const { error } = existing
        ? await service.from('job_offers').update(record).eq('id', existing.id)
        : await service.from('job_offers').insert(record);

      if (error) throw error;
      imported += 1;
    }

    await service
      .from('job_offers')
      .update({ status: 'closed' })
      .eq('source_name', 'job_opportunities_api')
      .lt('last_seen_at', started);

    return Response.json({ imported, discovered: offers.length, source: 'Job Opportunities API' }, { headers });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : JSON.stringify(error);

    return Response.json({
      error: message || 'Import impossible.',
    }, { status: 500, headers });
  }
});
