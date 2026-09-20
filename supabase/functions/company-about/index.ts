import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function textFromHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function metadata(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return textFromHtml(match[1]);
  }
  return '';
}

function safePublicUrl(raw: string) {
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  const host = url.hostname.toLowerCase();
  const blocked = host === 'localhost' || host.endsWith('.localhost') ||
    host === '0.0.0.0' || host === '::1' ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^fc|^fd|^fe80:/i.test(host);
  if (!['http:', 'https:'].includes(url.protocol) || blocked) throw new Error('Adresse du site non autorisée.');
  return url;
}

async function fetchPublicPage(startUrl: URL) {
  let url = startUrl;
  for (let redirects = 0; redirects < 4; redirects++) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Marrakech-Career/1.0 (+public-company-summary)' },
      signal: AbortSignal.timeout(8000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirection invalide.');
      url = safePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Le site a répondu avec le code ${response.status}.`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error('Le site ne fournit pas une page HTML.');
    return { html: (await response.text()).slice(0, 400_000), url: url.toString() };
  }
  throw new Error('Trop de redirections.');
}

function descriptionFromPage(html: string, companyName: string) {
  const description = metadata(html, 'description') || metadata(html, 'og:description');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const result = description || textFromHtml(h1) || textFromHtml(title);
  if (!result || result.length < 12) return `${companyName} dispose d’un site officiel, mais aucune présentation exploitable n’a été trouvée.`;
  return result.slice(0, 900);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await service.auth.getUser(token);
    if (userError || !user) return Response.json({ error: 'Session invalide.' }, { status: 401, headers: corsHeaders });

    const { companyId } = await request.json();
    if (!Number.isInteger(companyId)) return Response.json({ error: 'Entreprise invalide.' }, { status: 400, headers: corsHeaders });
    const { data: company, error: companyError } = await service.from('entreprises')
      .select('id, nom, site_web, about_summary, about_source_url, about_updated_at')
      .eq('id', companyId).single();
    if (companyError || !company) return Response.json({ error: 'Entreprise introuvable.' }, { status: 404, headers: corsHeaders });

    const cachedAt = company.about_updated_at ? new Date(company.about_updated_at).getTime() : 0;
    if (company.about_summary && cachedAt && Date.now() - cachedAt < CACHE_AGE_MS) {
      return Response.json({ summary: company.about_summary, sourceUrl: company.about_source_url, cached: true }, { headers: corsHeaders });
    }
    if (!company.site_web) return Response.json({ summary: '', sourceUrl: '', cached: false }, { headers: corsHeaders });

    const { html, url } = await fetchPublicPage(safePublicUrl(company.site_web));
    const summary = descriptionFromPage(html, company.nom);
    const updatedAt = new Date().toISOString();
    await service.from('entreprises').update({ about_summary: summary, about_source_url: url, about_updated_at: updatedAt }).eq('id', company.id);
    return Response.json({ summary, sourceUrl: url, cached: false }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Impossible de lire le site officiel.' }, { status: 500, headers: corsHeaders });
  }
});
