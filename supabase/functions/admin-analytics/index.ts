import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => { const { count: total, error } = await query; return error ? 0 : (total ?? 0); };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user } } = await service.auth.getUser(token);
    const allowed = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (!user?.email || !allowed.includes(user.email.toLowerCase())) return Response.json({ error: 'Forbidden' }, { status: 403, headers });

    const [{ data: authUsers, error: usersError }, profilesCompleted, favorites, applications, offers, feedback] = await Promise.all([
      service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      count(service.from('profiles').select('*', { count: 'exact', head: true }).not('job_title', 'is', null).not('skills', 'is', null)),
      count(service.from('favoris').select('*', { count: 'exact', head: true })),
      service.from('candidatures').select('statut'),
      service.from('job_offers').select('status'),
      service.from('user_feedback').select('rating, comment'),
    ]);
    if (usersError) throw usersError;
    const users = authUsers.users || [];
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const applicationsByStatus: Record<string, number> = {};
    for (const item of applications.data || []) { const status = typeof item.statut === 'string' ? item.statut : 'saved'; applicationsByStatus[status] = (applicationsByStatus[status] || 0) + 1; }
    const offerStatus = { total: 0, verified: 0, pending: 0, closed: 0 };
    for (const item of offers.data || []) { offerStatus.total += 1; if (item.status === 'verified') offerStatus.verified += 1; else if (item.status === 'closed') offerStatus.closed += 1; else offerStatus.pending += 1; }
    const ratings = [1, 2, 3, 4, 5].map((rating) => ({ rating, value: (feedback.data || []).filter((item) => item.rating === rating).length }));
    const totalFeedback = ratings.reduce((sum, item) => sum + item.value, 0);
    const averageRating = totalFeedback ? Math.round(ratings.reduce((sum, item) => sum + item.rating * item.value, 0) / totalFeedback * 10) / 10 : 0;
    let interpretation = totalFeedback ? `${averageRating}/5 de satisfaction sur ${totalFeedback} avis.` : 'Aucun avis utilisateur pour le moment.';
    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (groqKey && totalFeedback) {
      const comments = (feedback.data || []).map((item) => item.comment).filter(Boolean).slice(0, 30);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${groqKey}` }, body: JSON.stringify({ model: 'openai/gpt-oss-20b', temperature: 0.2, max_tokens: 110, messages: [{ role: 'system', content: 'Tu es data analyst. Interprète des avis agrégés en français, en deux phrases maximum, sans nom ni donnée personnelle.' }, { role: 'user', content: JSON.stringify({ ratings, averageRating, comments }) }] }) });
      const text = await response.json().catch(() => null);
      interpretation = text?.choices?.[0]?.message?.content?.trim() || interpretation;
    }
    return Response.json({ users: { total: users.length, newLast30Days: users.filter((item) => Date.parse(item.created_at) >= since).length, profilesCompleted }, activity: { favorites, applications: (applications.data || []).length, applicationsByStatus }, offers: offerStatus, feedback: { total: totalFeedback, averageRating, ratings, interpretation } }, { headers });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erreur d’administration.' }, { status: 500, headers }); }
});
