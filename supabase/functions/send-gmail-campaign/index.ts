import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Recipient = { id?: number; name?: string; email?: string };

function base64Encode(bytes: Uint8Array) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function base64Decode(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function urlSafeBase64(bytes: Uint8Array) {
  return base64Encode(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function decrypt(value: string, secret: string) {
  const [ivText, cipherText] = value.split('.');
  if (!ivText || !cipherText) throw new Error('Jeton Gmail invalide.');
  const key = await crypto.subtle.importKey('raw', base64Decode(secret), { name: 'AES-GCM' }, false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64Decode(ivText) }, key, base64Decode(cipherText));
  return new TextDecoder().decode(clear);
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${base64Encode(new TextEncoder().encode(value))}?=`;
}

function createMimeMessage(to: string, subject: string, message: string, cv: File) {
  const boundary = `mc_${crypto.randomUUID().replaceAll('-', '')}`;
  return cv.arrayBuffer().then((buffer) => [
    `To: ${to}`,
    `Subject: ${encodedHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Encode(new TextEncoder().encode(message)),
    `--${boundary}`,
    `Content-Type: ${cv.type || 'application/octet-stream'}; name="${encodedHeader(cv.name)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${encodedHeader(cv.name)}"`,
    '',
    base64Encode(new Uint8Array(buffer)),
    `--${boundary}--`,
    '',
  ].join('\r\n'));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  try {
    const form = await request.formData();
    const cv = form.get('cv');
    const subject = form.get('subject');
    const message = form.get('message');
    const rawRecipients = form.get('candidates');
    if (!(cv instanceof File) || cv.size === 0 || cv.size > 10 * 1024 * 1024) return Response.json({ error: 'Le CV est invalide ou dépasse 10 Mo.' }, { status: 400, headers: corsHeaders });
    if (typeof subject !== 'string' || typeof message !== 'string' || typeof rawRecipients !== 'string') return Response.json({ error: 'Données de campagne invalides.' }, { status: 400, headers: corsHeaders });
    const recipients = JSON.parse(rawRecipients) as Recipient[];
    const validRecipients = recipients.filter((recipient) => typeof recipient.email === 'string' && recipient.email.includes('@')).slice(0, 30);
    if (validRecipients.length === 0) return Response.json({ error: 'Aucun destinataire valide.' }, { status: 400, headers: corsHeaders });

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const service = createClient(url, serviceRoleKey);
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await service.auth.getUser(token);
    if (userError || !user) return Response.json({ error: 'Session invalide.' }, { status: 401, headers: corsHeaders });

    const defaultSenderEmail = 'marrakechcareer@gmail.com';
    const { data: connection, error: connectionError } = await service.schema('private').from('gmail_connections')
      .select('email, encrypted_refresh_token')
      .eq('email', Deno.env.get('MARRAKECH_CAREER_SENDER_EMAIL') || defaultSenderEmail)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return Response.json({ error: 'Le Gmail officiel Marrakech Career n’est pas encore connecté.' }, { status: 400, headers: corsHeaders });

    const encryptionKey = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY');
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!encryptionKey || !clientId || !clientSecret) throw new Error('Les secrets Gmail du serveur ne sont pas configurés.');
    const refreshToken = await decrypt(connection.encrypted_refresh_token, encryptionKey);
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const refreshPayload = await refreshResponse.json();
    if (!refreshResponse.ok || !refreshPayload.access_token) return Response.json({ error: 'Votre connexion Gmail a expiré. Reconnectez Gmail dans les paramètres.' }, { status: 401, headers: corsHeaders });

    const results = [] as { email: string; ok: boolean }[];
    for (const recipient of validRecipients) {
      const mime = await createMimeMessage(recipient.email!, subject, message, cv);
      const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${refreshPayload.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: urlSafeBase64(new TextEncoder().encode(mime)) }),
      });
      results.push({ email: recipient.email!, ok: gmailResponse.ok });
    }
    const sent = results.filter((result) => result.ok).length;
    return Response.json({ sent, failed: results.length - sent, results }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Impossible d’envoyer la campagne.' }, { status: 500, headers: corsHeaders });
  }
});
