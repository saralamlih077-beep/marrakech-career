import { createClient } from 'npm:@supabase/supabase-js@2';
import { CV_BUCKET, SEND_SCOPE, GmailError, cors, authenticatedUser, rpc, gmailConnection, normalizeRecipients, randomToken, tokenHash, failureResponse } from '../_shared/personal-gmail.ts';

export async function handleCampaign(request: Request, service: any, env: (key: string) => string | undefined, fetcher = fetch) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
  let dispatchStarted = false;
  try {
    const user = await authenticatedUser(service, request);
    if (request.headers.get('content-type')?.includes('application/json')) {
      const input = await request.json();
      if (input.action !== 'status' || !/^[0-9a-f-]{36}$/i.test(input.jobId)) throw new GmailError('Envoi invalide.');
      const job = await rpc(service, 'mc_get_gmail_job', { p_id: input.jobId, p_user_id: user.id });
      if (!job) throw new GmailError('Envoi introuvable.', 404);
      const results = Array.isArray(job.results) ? job.results : [];
      if (['failed', 'unknown'].includes(job.status)) {
        // Recover tracking after an interrupted worker, without ever sending again.
        for (const recipient of job.payload?.recipients ?? []) {
          const confirmation = results.find((r: any) => r.email === recipient.email && r.ok && r.messageId);
          await service.from('candidatures').update(confirmation
            ? { statut: 'applied', delivery_status: 'sent', sent_at: confirmation.sentAt, date_postulee: confirmation.sentAt, delivery_error: null, notes: `Envoyée depuis ${job.sender_email} — Gmail ${confirmation.messageId}` }
            : { delivery_status: job.status === 'unknown' ? 'unknown' : 'failed', delivery_error: job.error }).eq('id', recipient.applicationId).eq('user_id', user.id).eq('delivery_status', 'queued');
        }
        await service.storage.from(CV_BUCKET).remove([job.payload.cvPath]);
      }
      return Response.json({ jobId: job.id, status: job.status, senderEmail: job.sender_email, results, sent: results.filter((r: any) => r.ok).length,
        failed: results.filter((r: any) => r.status === 'failed').length, unknown: results.filter((r: any) => r.status === 'unknown').length, error: job.error }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
    }
    const webhook = env('N8N_GMAIL_WEBHOOK_URL'); const secret = env('N8N_GMAIL_WEBHOOK_SECRET');
    if (!webhook?.startsWith('https://') || !secret || secret.length < 32) throw new GmailError('L’envoi des candidatures attend l’activation de n8n.', 503);
    const connection = await gmailConnection(service, user.id);
    if (!connection?.scopes?.includes(SEND_SCOPE)) throw new GmailError('Connectez et autorisez votre Gmail avant de postuler.', 409);
    const form = await request.formData(); const cv = form.get('cv'); const subject = form.get('subject'); const message = form.get('message');
    const jobId = String(form.get('requestId') ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) throw new GmailError('Identifiant d’envoi invalide.');
    const existing = await rpc(service, 'mc_get_gmail_job', { p_id: jobId, p_user_id: user.id });
    if (existing) return Response.json({ jobId, status: existing.status }, { status: 202, headers: cors });
    if (!(cv instanceof File) || !cv.size || cv.size > 10485760) throw new GmailError('Choisissez un CV de 10 Mo maximum.');
    const types: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    const cvType = types[cv.name.split('.').at(-1)?.toLowerCase() ?? ''];
    if (!cvType || (cv.type && cv.type !== cvType && cv.type !== 'application/octet-stream')) throw new GmailError('Choisissez un CV PDF, DOC ou DOCX.');
    if (typeof subject !== 'string' || !subject.trim() || subject.length > 500 || typeof message !== 'string' || message.length > 30000) throw new GmailError('Objet ou message invalide.');
    const recipients = normalizeRecipients(JSON.parse(String(form.get('candidates'))));
    const dispatchToken = randomToken(); const cvPath = `${user.id}/${jobId}/cv`;
    const payload = { recipients, subject, message, cvPath, cvName: cv.name.slice(0, 200), cvType, position: String(form.get('position') || 'Candidature').slice(0, 250) };
    const { error: uploadError } = await service.storage.from(CV_BUCKET).upload(cvPath, cv, { contentType: cvType, upsert: false });
    if (uploadError) throw new GmailError('Impossible de joindre votre CV.', 503);
    try {
      const records = recipients.map(r => ({ id: r.applicationId, user_id: user.id, entreprise_id: r.id, poste: payload.position, statut: 'prepared', contact_email: r.email,
        cover_letter: message, cv_bucket: CV_BUCKET, cv_path: cvPath, cv_file_name: payload.cvName, cv_content_type: cvType, delivery_status: 'queued', notes: `Candidature en attente via n8n — Gmail : ${connection.email}` }));
      const { error } = await service.from('candidatures').insert(records);
      if (error) throw new GmailError('Impossible d’enregistrer la candidature.', 503);
      await rpc(service, 'mc_create_gmail_job', { p_job: { id: jobId, user_id: user.id, token_hash: await tokenHash(dispatchToken), sender_email: connection.email, payload } });
    } catch (error) {
      await service.storage.from(CV_BUCKET).remove([cvPath]);
      await service.from('candidatures').update({ delivery_status: 'failed', delivery_error: 'Préparation de l’envoi interrompue.' }).in('id', recipients.map(r => r.applicationId)).eq('user_id', user.id);
      throw error;
    }
    // No Gmail credential, CV or letter is transmitted to n8n.
    dispatchStarted = true;
    try {
      const result = await fetcher(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-marrakech-career-secret': secret },
        body: JSON.stringify({ jobId, dispatchToken }), signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!result.ok) throw new Error('Dispatch rejected');
    } catch {
      return Response.json({ jobId, status: 'queued', warning: 'Confirmation n8n en attente. Ne renvoyez pas cette candidature.' }, { status: 202, headers: cors });
    }
    return Response.json({ jobId, status: 'queued' }, { status: 202, headers: cors });
  } catch (error) {
    const response = failureResponse(error);
    const body = await response.json();
    // Only this handler can prove a preparation failure occurred before dispatch.
    // A gateway error or lost response has no such proof and must remain uncertain.
    return Response.json({ ...body, ...(!dispatchStarted ? { submissionAccepted: false } : {}) }, { status: response.status, headers: response.headers });
  }
}
if (typeof Deno !== 'undefined') Deno.serve(request => handleCampaign(request, createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), key => Deno.env.get(key)));
