import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char] || char));

const offerCard = (offer: { id: string; title: string; location: string; contract_type: string; entreprises: unknown }, appUrl: string) => {
  const company = Array.isArray(offer.entreprises) ? offer.entreprises[0] : offer.entreprises;
  const companyName = company && typeof company === 'object' && 'nom' in company
    ? String(company.nom || 'Entreprise')
    : 'Entreprise';
  const offerLink = `${appUrl.replace(/\/+$/, '')}/?offer=${encodeURIComponent(offer.id)}`;
  const link = `<a href="${escapeHtml(offerLink)}" style="display:inline-block;border-radius:8px;background:#621E3E;color:#fff;padding:10px 14px;font-weight:700;text-decoration:none;font-size:13px">Voir l’offre</a>`;
  return `<tr><td style="padding:0 0 14px"><div style="border:1px solid #EAE5E0;border-radius:14px;padding:16px;background:#fff"><div style="font-size:16px;font-weight:700;color:#1C1917;line-height:1.35">${escapeHtml(offer.title)}</div><div style="margin:5px 0 12px;font-size:13px;color:#57534E">${escapeHtml(companyName)} · ${escapeHtml(offer.contract_type)}<br>${escapeHtml(offer.location)}</div>${link}</div></td></tr>`;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });

  try {
    // Use the same secret precedence as sync-job-opportunities so the existing
    // n8n HTTP Request header authorizes both functions.
    const cronSecret = Deno.env.get('ADZUNA_SYNC_SECRET') || Deno.env.get('JOBSQUARE_SYNC_SECRET');
    if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const sender = Deno.env.get('BREVO_SENDER_EMAIL');
    const appUrl = Deno.env.get('APP_URL') || 'https://marrakech-career.vercel.app';
    if (!brevoKey || !sender) throw new Error('Brevo n’est pas configuré.');

    const { data: offers, error: offersError } = await service
      .from('job_offers')
      .select('id, title, contract_type, location, entreprises(nom)')
      .eq('status', 'verified')
      .order('created_at', { ascending: false });
    if (offersError) throw offersError;
    if (!offers?.length) return Response.json({ sent: 0, offersChecked: 0, message: 'Aucune offre active.' }, { headers });

    const { data: usersPage, error: usersError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const { data: preferences, error: preferencesError } = await service
      .from('job_alert_preferences')
      .select('user_id, enabled');
    if (preferencesError) throw preferencesError;
    const preferencesById = new Map((preferences || []).map((item) => [item.user_id, item]));
    const offerIds = offers.map((offer) => offer.id);
    let sent = 0;
    let deliveredOffers = 0;

    for (const user of usersPage.users || []) {
      if (!user.email || preferencesById.get(user.id)?.enabled === false) continue;
      const { data: deliveries, error: deliveriesError } = await service
        .from('job_alert_deliveries')
        .select('offer_id')
        .eq('user_id', user.id)
        .in('offer_id', offerIds);
      if (deliveriesError) throw deliveriesError;
      const alreadySent = new Set((deliveries || []).map((delivery) => delivery.offer_id));
      const newOffers = offers.filter((offer) => !alreadySent.has(offer.id));
      if (!newOffers.length) continue;

      const firstName = String(user.user_metadata?.full_name || user.email.split('@')[0]).split(/\s+/)[0];
      const html = `<!doctype html><html><body style="margin:0;background:#FBF9F7;font-family:Arial,sans-serif;color:#1C1917"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:26px 14px"><table role="presentation" width="100%" style="max-width:620px"><tr><td style="padding:24px;border-radius:18px;background:#621E3E;color:#fff"><div style="font-size:20px;font-weight:800">Marrakech Career</div><div style="margin-top:6px;color:#E5E78F;font-size:13px;font-weight:700">NOUVELLES OFFRES</div></td></tr><tr><td style="padding:24px 4px 8px"><p style="font-size:16px">Bonjour ${escapeHtml(firstName)},</p><p style="font-size:15px;line-height:1.6;color:#57534E">Voici les <strong>${newOffers.length}</strong> nouvelle${newOffers.length > 1 ? 's' : ''} offre${newOffers.length > 1 ? 's' : ''} disponibles à Marrakech :</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${newOffers.map((offer) => offerCard(offer, appUrl)).join('')}</table><p style="margin-top:16px;font-size:12px;color:#78716C">Vous recevez cet e-mail car les alertes de nouvelles offres sont activées dans Marrakech Career.</p></td></tr></table></td></tr></table></body></html>`;

      const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Marrakech Career', email: sender },
          to: [{ email: user.email }],
          subject: `${newOffers.length} nouvelle${newOffers.length > 1 ? 's' : ''} offre${newOffers.length > 1 ? 's' : ''} à Marrakech`,
          htmlContent: html,
        }),
      });
      if (!emailResponse.ok) continue;

      const { error: saveError } = await service.from('job_alert_deliveries').upsert(
        newOffers.map((offer) => ({ user_id: user.id, offer_id: offer.id, score: 0 })),
        { onConflict: 'user_id,offer_id' },
      );
      if (saveError) throw saveError;
      sent += 1;
      deliveredOffers += newOffers.length;
    }

    return Response.json({ sent, deliveredOffers, offersChecked: offers.length }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erreur d’alerte.' }, { status: 500, headers });
  }
});
