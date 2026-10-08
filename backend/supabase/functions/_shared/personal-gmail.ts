export const SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const CV_BUCKET = 'gmail-application-cvs';
export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
export const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;

export class GmailError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function randomToken(): string { return base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''); }
export async function tokenHash(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function encryptToken(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(secret), c => c.charCodeAt(0)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return `${base64(iv)}.${base64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))))}`;
}
export async function decryptToken(value: string, secret: string): Promise<string> {
  const [iv, body] = value.split('.');
  const bytes = (v: string) => Uint8Array.from(atob(v), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', bytes(secret), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, key, bytes(body)));
}
export function googleAuthorizationUrl(clientId: string, redirectUri: string, state: string, email?: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: `openid email ${SEND_SCOPE}`, access_type: 'offline', prompt: 'consent select_account', state }).toString();
  if (email && emailPattern.test(email)) url.searchParams.set('login_hint', email);
  return url.href;
}
export function normalizeRecipients(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new GmailError('Choisissez entre 1 et 30 destinataires.');
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item.email !== 'string' || !emailPattern.test(item.email)) throw new GmailError('Adresse du destinataire invalide.');
    const email = item.email.trim().toLowerCase();
    if (seen.has(email)) throw new GmailError('Un destinataire est sélectionné plusieurs fois.');
    seen.add(email);
    if (item.id != null && (!Number.isSafeInteger(item.id) || item.id <= 0)) throw new GmailError('Entreprise invalide.');
    return { id: item.id ?? null, email, name: String(item.name ?? '').slice(0, 200), applicationId: crypto.randomUUID() };
  });
}
export function mimeMessage(from: string, to: string, subject: string, message: string, cv: Uint8Array, fileName: string, fileType: string): string {
  if (!emailPattern.test(from) || !emailPattern.test(to)) throw new GmailError('Adresse Gmail invalide.');
  const encoded = (v: string) => `=?UTF-8?B?${base64(new TextEncoder().encode(v))}?=`;
  const folded = (v: Uint8Array) => base64(v).match(/.{1,76}/g)?.join('\r\n') ?? '';
  const boundary = `mc_${crypto.randomUUID()}`;
  const name = fileName.replace(/[\r\n"\\]/g, '_');
  const mime = [`From: ${from}`, `To: ${to}`, `Subject: ${encoded(subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', folded(new TextEncoder().encode(message)),
    `--${boundary}`, `Content-Type: ${fileType}`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${encoded(name)}"`, '', folded(cv), `--${boundary}--`, ''].join('\r\n');
  return base64(new TextEncoder().encode(mime)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
// A successful transport is insufficient: Gmail must return its message identifier.
export function confirmedDelivery(status: number, payload: unknown): string | null {
  return status >= 200 && status < 300 && !!payload && typeof (payload as { id?: unknown }).id === 'string' && (payload as { id: string }).id.length > 0 ? (payload as { id: string }).id : null;
}
export async function authenticatedUser(service: any, request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new GmailError('Reconnectez-vous à Marrakech Career.', 401);
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new GmailError('Votre session a expiré.', 401);
  return data.user;
}
export async function rpc(service: any, name: string, params: Record<string, unknown>) {
  const { data, error } = await service.rpc(name, params);
  if (error) throw new GmailError('Le service de candidature Gmail n’est pas encore configuré.', 503);
  return data;
}
export async function gmailConnection(service: any, userId: string) {
  return rpc(service, 'mc_get_gmail_connection', { p_user_id: userId });
}
export async function accessToken(connection: any, env: (key: string) => string | undefined, fetcher = fetch) {
  const secret = env('GMAIL_TOKEN_ENCRYPTION_KEY');
  const clientId = env('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = env('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!secret || !clientId || !clientSecret) throw new GmailError('La connexion Gmail n’est pas encore configurée.', 503);
  const refreshToken = await decryptToken(connection.encrypted_refresh_token, secret);
  const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok || typeof data.access_token !== 'string') throw new GmailError('Reconnectez votre Gmail : son autorisation a expiré.', 401);
  if (typeof data.scope === 'string' && !data.scope.split(' ').includes(SEND_SCOPE)) throw new GmailError('Autorisez l’envoi des candidatures dans Google.', 403);
  return data.access_token;
}
export function failureResponse(error: unknown) {
  return Response.json({ error: error instanceof GmailError ? error.message : 'Le service Gmail est momentanément indisponible.' }, { status: error instanceof GmailError ? error.status : 503, headers: cors });
}
