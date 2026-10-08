import { createClient } from 'npm:@supabase/supabase-js@2';
import { SEND_SCOPE, GmailError, cors, authenticatedUser, rpc, gmailConnection, googleAuthorizationUrl, randomToken, tokenHash, encryptToken, failureResponse, emailPattern } from '../_shared/personal-gmail.ts';

export async function handleConnection(request: Request, service: any, env: (key: string) => string | undefined, fetcher = fetch) {
  const appOrigin = new URL(env('MARRAKECH_CAREER_APP_URL') || 'https://marrakech-career.vercel.app').origin;
  const callback = `${env('SUPABASE_URL')}/functions/v1/gmail-connection`;
  const allowed = [appOrigin, ...(env('GMAIL_ALLOWED_ORIGINS') || '').split(',').filter(Boolean)];
  const ready = !!(env('GOOGLE_OAUTH_CLIENT_ID') && env('GOOGLE_OAUTH_CLIENT_SECRET') && env('GMAIL_TOKEN_ENCRYPTION_KEY'));
  const deliveryReady = ready && !!(env('N8N_GMAIL_WEBHOOK_URL')?.startsWith('https://') && (env('N8N_GMAIL_WEBHOOK_SECRET')?.length ?? 0) >= 32);
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method === 'GET') {
    let origin = appOrigin;
    let status = 'error';
    let reason = 'invalid_state';
    try {
      const params = new URL(request.url).searchParams;
      const state = params.get('state');
      if (!state) throw new GmailError('État manquant.');
      const owner = await rpc(service, 'mc_consume_gmail_oauth', { p_hash: await tokenHash(state) });
      if (!owner || !allowed.includes(owner.origin)) throw new GmailError('Connexion expirée.');
      origin = owner.origin;
      reason = 'authorization_failed';
      if (!ready || params.get('error') || !params.get('code')) throw new GmailError('Autorisation refusée.');
      const exchange = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: params.get('code')!, client_id: env('GOOGLE_OAUTH_CLIENT_ID')!, client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET')!, redirect_uri: callback, grant_type: 'authorization_code' }), signal: AbortSignal.timeout(10000) });
      const tokens = await exchange.json();
      if (!exchange.ok || typeof tokens.access_token !== 'string' || !String(tokens.scope || '').split(' ').includes(SEND_SCOPE)) throw new GmailError('Autorisation d’envoi manquante.');
      const identityResponse = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(10000) });
      const identity = await identityResponse.json();
      if (!identityResponse.ok || identity.email_verified !== true || typeof identity.email !== 'string' || !emailPattern.test(identity.email)) throw new GmailError('Compte non vérifié.');
      const previous = await gmailConnection(service, owner.user_id);
      // Never keep the previous account's credential when changing Gmail.
      const encrypted = typeof tokens.refresh_token === 'string'
        ? await encryptToken(tokens.refresh_token, env('GMAIL_TOKEN_ENCRYPTION_KEY')!)
        : previous?.email === identity.email ? previous.encrypted_refresh_token : null;
      if (!encrypted) throw new GmailError('Autorisation permanente manquante.');
      await rpc(service, 'mc_store_gmail_connection', { p_user_id: owner.user_id, p_email: identity.email, p_token: encrypted, p_scopes: tokens.scope.split(' ') });
      status = 'connected'; reason = '';
    } catch { /* No provider response, authorization code or token is exposed to the browser. */ }
    const destination = new URL('/gmail-callback.html', origin);
    destination.searchParams.set('status', status);
    if (reason) destination.searchParams.set('reason', reason);
    return new Response(null, { status: 302, headers: { Location: destination.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  try {
    const user = await authenticatedUser(service, request);
    const input = await request.json();
    if (input.action === 'status') {
      const connection = await gmailConnection(service, user.id);
      return Response.json({ connected: !!connection?.scopes?.includes(SEND_SCOPE), email: connection?.email ?? null, ready, deliveryReady }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
    }
    if (input.action === 'disconnect') {
      await rpc(service, 'mc_disconnect_gmail', { p_user_id: user.id });
      return Response.json({ ok: true }, { headers: cors });
    }
    if (input.action !== 'connect') throw new GmailError('Action invalide.');
    if (!ready) throw new GmailError('La connexion Gmail n’est pas encore configurée.', 503);
    const origin = request.headers.get('origin');
    if (!origin || !allowed.includes(origin)) throw new GmailError('Origine non autorisée.', 403);
    const state = randomToken();
    await rpc(service, 'mc_start_gmail_oauth', { p_user_id: user.id, p_hash: await tokenHash(state), p_origin: origin });
    // The registration email is only a suggestion. Ownership comes from Google's identity response.
    const hint = input.useRegistrationEmail === true ? user.email : undefined;
    return Response.json({ url: googleAuthorizationUrl(env('GOOGLE_OAUTH_CLIENT_ID')!, callback, state, hint) }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
  } catch (error) { return failureResponse(error); }
}
if (typeof Deno !== 'undefined') Deno.serve(request => handleConnection(request, createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), key => Deno.env.get(key)));
