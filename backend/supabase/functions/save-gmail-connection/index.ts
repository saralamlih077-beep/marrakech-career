// Retired: the browser must never submit a refresh token and a claimed sender.
// gmail-connection now validates Google's identity on the server and preserves the app account.
Deno.serve(request => request.method === 'OPTIONS'
  ? new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' } })
  : Response.json({ error: 'Connectez votre Gmail depuis votre candidature avec le nouveau parcours Google.' }, { status: 410, headers: { 'Access-Control-Allow-Origin': '*' } }));
