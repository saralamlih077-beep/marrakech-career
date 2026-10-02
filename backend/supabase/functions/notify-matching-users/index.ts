import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' };
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const words = (value: string) => [...new Set(normalize(value).split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2))];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    const cronSecret = Deno.env.get('JOBSQUARE_SYNC_SECRET');
    if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: offers, error: offersError } = await service.from('job_offers').select('id, title, contract_type, location, description, requirements, skills, source_url, entreprises(nom, email)').eq('status', 'verified');
    if (offersError) throw offersError;
    const { data: usersPage, error: usersError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const { data: profiles } = await service.from('profiles').select('id, job_title, skills, education, experience, projects, languages');
    const { data: preferences } = await service.from('job_alert_preferences').select('user_id, enabled, min_match');
    const profilesById = new Map((profiles || []).map((item) => [item.id, item]));
    const preferencesById = new Map((preferences || []).map((item) => [item.user_id, item]));
    const brevoKey = Deno.env.get('BREVO_API_KEY'); const sender = Deno.env.get('BREVO_SENDER_EMAIL');
    if (!brevoKey || !sender) throw new Error('Brevo n’est pas configuré.');
    let sent = 0;
    for (const user of usersPage.users || []) {
      if (!user.email) continue;
      const preference = preferencesById.get(user.id);
      if (preference?.enabled === false) continue;
      const profile = profilesById.get(user.id);
      const profileWords = words(Object.values(profile || {}).filter((value): value is string => typeof value === 'string').join(' '));
      if (!profileWords.length) continue;
      for (const offer of offers || []) {
        const offerWords = new Set(words(`${offer.title} ${offer.description} ${offer.requirements} ${(offer.skills || []).join(' ')}`));
        const score = Math.min(100, Math.round(profileWords.filter((word) => offerWords.has(word)).length * 14));
        if (score < (preference?.min_match ?? 60)) continue;
        const { data: prior } = await service.from('job_alert_deliveries').select('id').eq('user_id', user.id).eq('offer_id', offer.id).maybeSingle();
        if (prior) continue;
        const company = Array.isArray(offer.entreprises) ? offer.entreprises[0] : offer.entreprises;
        const companyName = company?.nom || 'Entreprise non renseignée';
        const contact = company?.email ? `<p>Contact : <a href="mailto:${escapeHtml(company.email)}">${escapeHtml(company.email)}</a></p>` : '';
        const link = offer.source_url ? `<p><a href="${offer.source_url}">Voir l’offre</a></p>` : '';
        const html = `<p>Bonjour,</p><p>Une nouvelle offre correspond à votre profil à <strong>${score}%</strong>.</p><p><strong>${escapeHtml(offer.title)}</strong><br>${escapeHtml(offer.location)} · ${escapeHtml(offer.contract_type)}<br>Entreprise : ${escapeHtml(companyName)}</p>${contact}${link}`;
        const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': brevoKey, 'content-type': 'application/json' }, body: JSON.stringify({ sender: { name: 'Marrakech Career', email: sender }, to: [{ email: user.email }], subject: `Nouvelle offre adaptée : ${offer.title}`, htmlContent: html }) });
        if (!response.ok) continue;
        await service.from('job_alert_deliveries').insert({ user_id: user.id, offer_id: offer.id, score });
        sent += 1;
      }
    }
    return Response.json({ sent, offersChecked: offers?.length || 0 }, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erreur d’alerte.' }, { status: 500, headers }); }
});
