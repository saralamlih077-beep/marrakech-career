const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ChatTurn = { role: 'user' | 'ai'; text: string };
type Company = { nom?: string; domaine?: string | null; sous_domaine?: string | null; note?: number | null; email?: string | null };
type Profile = { full_name?: string; job_title?: string; education?: string; skills?: string; experience?: string };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
  if (!request.headers.get('Authorization')) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  try {
    const { message, history = [], companies = [], profile = {} } = await request.json() as { message?: unknown; history?: ChatTurn[]; companies?: Company[]; profile?: Profile };
    if (typeof message !== 'string' || !message.trim() || message.length > 4000) return Response.json({ error: 'Message invalide.' }, { status: 400, headers: corsHeaders });

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500, headers: corsHeaders });

    const companySummary = companies.slice(0, 25).map((company) => `- ${company.nom ?? 'Entreprise'} (${company.domaine ?? 'Général'}${company.sous_domaine ? ` / ${company.sous_domaine}` : ''}), note ${company.note ?? 'N/A'}, contact ${company.email ?? 'N/A'}`).join('\n');
    const profileSummary = `Candidat : ${profile.full_name ?? 'Non renseigné'}; poste : ${profile.job_title ?? 'Non renseigné'}; études : ${profile.education ?? 'Non renseigné'}; compétences : ${profile.skills ?? 'Non renseigné'}; expérience : ${profile.experience ?? 'Non renseignée'}.`;
    const contents = [...history.slice(-6), { role: 'user' as const, text: message.trim() }].map((turn) => ({ role: turn.role === 'ai' ? 'model' : 'user', parts: [{ text: turn.text }] }));
    const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: [{ text: `Tu es l’assistant carrière de Marrakech Career Hub. Réponds dans la langue de l’utilisateur, de façon concise, fiable et bienveillante. ${profileSummary}\nEntreprises :\n${companySummary}` }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1200 } }),
    });
    if (!googleResponse.ok) return Response.json({ error: 'Le fournisseur IA a renvoyé une erreur.' }, { status: 502, headers: corsHeaders });
    const payload = await googleResponse.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim();
    if (!text) return Response.json({ error: 'Réponse IA vide.' }, { status: 502, headers: corsHeaders });
    return Response.json({ text }, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return Response.json({ error: 'Erreur inattendue du service IA.' }, { status: 500, headers: corsHeaders });
  }
});
