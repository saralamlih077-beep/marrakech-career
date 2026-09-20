import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64Encode(bytes: Uint8Array) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function base64Decode(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function encrypt(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', base64Decode(secret), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `${base64Encode(iv)}.${base64Encode(new Uint8Array(encrypted))}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const service = createClient(url, serviceRoleKey);
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await service.auth.getUser(token);
    if (userError || !user) return Response.json({ error: 'Session invalide.' }, { status: 401, headers: corsHeaders });

    const { email, refreshToken, scopes = [] } = await request.json();
    if (typeof email !== 'string' || !email.includes('@') || typeof refreshToken !== 'string' || refreshToken.length < 20) {
      return Response.json({ error: 'Google n’a pas fourni de jeton de renouvellement. Déconnectez puis reconnectez Gmail avec l’autorisation demandée.' }, { status: 400, headers: corsHeaders });
    }
    const encryptionKey = Deno.env.get('GMAIL_TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) return Response.json({ error: 'Le serveur Gmail n’est pas encore configuré.' }, { status: 500, headers: corsHeaders });

    const { error: saveError } = await service.schema('private').from('gmail_connections').upsert({
      user_id: user.id,
      email,
      encrypted_refresh_token: await encrypt(refreshToken, encryptionKey),
      scopes: Array.isArray(scopes) ? scopes.filter((scope): scope is string => typeof scope === 'string') : [],
      updated_at: new Date().toISOString(),
    });
    if (saveError) throw saveError;
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Impossible de connecter Gmail.' }, { status: 500, headers: corsHeaders });
  }
});
