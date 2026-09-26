import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user } } = await service.auth.getUser(token);
    if (!user?.email) return Response.json({ error: 'Utilisateur non connecté.' }, { status: 401, headers });
    const { offerId, manual = false } = await request.json();
    const [{ data: offer }, { data: profile }, { data: preference }] = await Promise.all([
      service.from('job_offers').select('title, contract_type, location, description, requirements, skills, source_url, status, entreprises(nom, email)').eq('id', offerId).single(),
      service.from('profiles').select('job_title, skills, education, experience').eq('id', user.id).maybeSingle(),
      service.from('job_alert_preferences').select('enabled, min_match').eq('user_id', user.id).maybeSingle(),
    ]);
    if (!offer || offer.status !== 'verified') return Response.json({ error: 'Offre indisponible.' }, { status: 404, headers });
    if (preference?.enabled === false) return Response.json({ sent: false, reason: 'alerts-disabled' }, { headers });
    const profileText = normalize(Object.values(profile ?? {}).filter((v): v is string => typeof v === 'string').join(' '));
    const offerText = normalize(`${offer.title} ${offer.description} ${offer.requirements} ${(offer.skills || []).join(' ')}`);
    const terms = [...new Set(profileText.split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2))];
    const score = Math.min(100, Math.round(terms.filter((term) => offerText.includes(term)).length * 14));
    // A user who explicitly clicks “M’alerter” asked for this exact offer.
    // The match threshold remains for automatic alerts only.
    if (!manual && score < (preference?.min_match ?? 60)) return Response.json({ sent: false, score, reason: 'below-threshold' }, { headers });
    const apiKey = Deno.env.get('BREVO_API_KEY'); const sender = Deno.env.get('BREVO_SENDER_EMAIL');
    if (!apiKey || !sender) throw new Error('Brevo n’est pas configuré.');
    const company = Array.isArray(offer.entreprises) ? offer.entreprises[0] : offer.entreprises;
    const companyName = company?.nom || 'Entreprise non renseignée';
    const companyEmail = company?.email || '';
    const skills = Array.isArray(offer.skills) ? offer.skills.filter(Boolean) : [];
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ sender: { name: 'Marrakech Career', email: sender }, to: [{ email: user.email }], subject: `Alerte offre : ${offer.title}`, htmlContent: `<p>Bonjour,</p><p>${manual ? 'Vous avez demandé une alerte pour cette offre.' : `Une offre correspond à votre profil (${score}%).`}</p><p><strong>${offer.title}</strong><br>${offer.location} · ${offer.contract_type}</p><p><strong>Entreprise :</strong> ${companyName}</p>${skills.length ? `<p><strong>Compétences demandées :</strong> ${skills.join(', ')}</p>` : ''}${companyEmail ? `<p><strong>Email de contact :</strong> <a href="mailto:${companyEmail}">${companyEmail}</a></p>` : '<p><strong>Email de contact :</strong> non renseigné</p>'}${offer.source_url ? `<p><a href="${offer.source_url}">Voir l’offre</a></p>` : ''}` }) });
    if (!emailResponse.ok) throw new Error('Brevo a refusé l’envoi.');
    return Response.json({ sent: true, score }, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erreur d’alerte.' }, { status: 500, headers }); }
});
