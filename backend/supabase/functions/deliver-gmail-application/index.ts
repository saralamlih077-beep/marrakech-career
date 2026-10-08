import { createClient } from 'npm:@supabase/supabase-js@2';
import { CV_BUCKET, SEND_SCOPE, cors, rpc, gmailConnection, accessToken, tokenHash, mimeMessage, confirmedDelivery, failureResponse } from '../_shared/personal-gmail.ts';

export async function handleDelivery(request: Request, service: any, env: (key: string) => string | undefined, fetcher = fetch) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  const results: any[] = []; let job: any;
  try {
    const input = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(input.jobId) || typeof input.dispatchToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.dispatchToken)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    job = await rpc(service, 'mc_claim_gmail_job', { p_id: input.jobId, p_hash: await tokenHash(input.dispatchToken) });
    if (!job) return Response.json({ error: 'Envoi déjà traité, expiré ou non autorisé.' }, { status: 409 });
    const connection = await gmailConnection(service, job.user_id);
    if (!connection?.scopes?.includes(SEND_SCOPE) || connection.email !== job.sender_email) throw new Error('Gmail changed or disconnected');
    const token = await accessToken(connection, env, fetcher);
    const { data: cv, error: cvError } = await service.storage.from(CV_BUCKET).download(job.payload.cvPath);
    if (cvError || !cv) throw new Error('CV unavailable');
    const bytes = new Uint8Array(await cv.arrayBuffer()); const deadline = Date.now() + 45000;
    for (const recipient of job.payload.recipients) {
      let status = 'failed'; let messageId: string | null = null;
      if (Date.now() < deadline) {
        try {
          const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: mimeMessage(job.sender_email, recipient.email, job.payload.subject, job.payload.message, bytes, job.payload.cvName, job.payload.cvType) }), signal: AbortSignal.timeout(Math.min(10000, Math.max(1, deadline - Date.now()))) });
          const data = await response.json().catch(() => null); messageId = confirmedDelivery(response.status, data);
          status = messageId ? 'sent' : response.status >= 500 || response.ok ? 'unknown' : 'failed';
        } catch { status = 'unknown'; }
      }
      const sentAt = status === 'sent' ? new Date().toISOString() : null;
      results.push({ email: recipient.email, ok: status === 'sent', status, messageId, sentAt });
      await rpc(service, 'mc_finish_gmail_job', { p_id: job.id, p_results: results, p_status: 'sending', p_error: null });
      const { error: trackingError } = await service.from('candidatures').update({ statut: status === 'sent' ? 'applied' : 'prepared', delivery_status: status,
        date_postulee: sentAt, sent_at: sentAt, delivery_error: status === 'unknown' ? 'Vérifiez Messages envoyés avant de réessayer.' : status === 'failed' ? 'Gmail n’a pas confirmé cet envoi.' : null,
        notes: status === 'sent' ? `Envoyée depuis ${job.sender_email} — Gmail ${messageId}` : `Envoi ${status} depuis ${job.sender_email}` }).eq('id', recipient.applicationId).eq('user_id', job.user_id);
      if (trackingError) throw new Error('Tracking interrupted');
    }
    const sent = results.filter(r => r.ok).length;
    await rpc(service, 'mc_finish_gmail_job', { p_id: job.id, p_results: results, p_status: 'done', p_error: null });
    await service.storage.from(CV_BUCKET).remove([job.payload.cvPath]);
    return Response.json({ jobId: job.id, processed: true, sent, failed: results.filter(r => r.status === 'failed').length, unknown: results.filter(r => r.status === 'unknown').length });
  } catch (error) {
    if (job) {
      const attempted = new Set(results.map(r => r.email));
      const remaining = job.payload.recipients.filter((r: any) => !attempted.has(r.email));
      results.push(...remaining.map((r: any) => ({ email: r.email, ok: false, status: 'failed', messageId: null })));
      await rpc(service, 'mc_finish_gmail_job', { p_id: job.id, p_results: results, p_status: results.some(r => r.status === 'unknown') ? 'unknown' : 'failed', p_error: 'Envoi interrompu. Vérifiez les confirmations avant de réessayer.' });
      if (remaining.length) await service.from('candidatures').update({ delivery_status: 'failed', delivery_error: 'Envoi interrompu avant confirmation.' }).in('id', remaining.map((r: any) => r.applicationId)).eq('user_id', job.user_id);
      await service.storage.from(CV_BUCKET).remove([job.payload.cvPath]);
    }
    return failureResponse(error);
  }
}
if (typeof Deno !== 'undefined') Deno.serve(request => handleDelivery(request, createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), key => Deno.env.get(key)));
