import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const maxCvBytes = 10 * 1024 * 1024;
const acceptedExtensions = /\.(pdf|doc|docx)$/i;
const acceptedTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '') || 'cv.pdf';
}

function base64Encode(bytes: Uint8Array) {
  let output = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(output);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

/** Sends Marrakech Career a private copy only after the company has accepted the delivery. */
async function sendMarrakechCareerCopy(input: {
  apiKey: string;
  senderEmail: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  companyEmail: string;
  position: string;
  subject: string;
  coverLetter: string;
  cv: File;
  fileName: string;
}) {
  const notificationEmail = Deno.env.get('MARRAKECH_CAREER_NOTIFICATION_EMAIL') || 'marrakechcareer@gmail.com';
  const sentAt = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca', dateStyle: 'full', timeStyle: 'short' });
  const htmlLetter = escapeHtml(input.coverLetter).replace(/\n/g, '<br>');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.55">
    <h2>Copie de candidature envoyée</h2>
    <p><strong>Candidat :</strong> ${escapeHtml(input.candidateName)}<br>
    <strong>E-mail du candidat :</strong> ${escapeHtml(input.candidateEmail)}<br>
    <strong>Entreprise contactée :</strong> ${escapeHtml(input.companyName)} (${escapeHtml(input.companyEmail)})<br>
    <strong>Poste :</strong> ${escapeHtml(input.position)}<br>
    <strong>Date d’envoi :</strong> ${escapeHtml(sentAt)}</p>
    <hr><p><strong>Objet envoyé :</strong> ${escapeHtml(input.subject)}</p><p>${htmlLetter}</p>
  </div>`;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': input.apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Marrakech Career', email: input.senderEmail },
      to: [{ email: notificationEmail, name: 'Marrakech Career' }],
      replyTo: { email: input.candidateEmail, name: input.candidateName },
      subject: `[Copie Marrakech Career] ${input.subject}`,
      htmlContent: html,
      attachment: [{ content: base64Encode(new Uint8Array(await input.cv.arrayBuffer())), name: input.fileName }],
    }),
  });
  if (!response.ok) throw new Error((await response.text()).slice(0, 300));
}

async function readN8nResult(response: Response) {
  const body = await response.text();
  if (!body) return {};
  try { return JSON.parse(body) as Record<string, unknown>; } catch { return { message: body }; }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Utilisateur non authentifié.' }, { status: 401, headers: corsHeaders });

  let applicationId = '';
  let service: ReturnType<typeof createClient> | undefined;

  try {
    const form = await request.formData();
    const cv = form.get('cv');
    const companyId = Number(cleanText(form.get('companyId'), 32));
    const companyName = cleanText(form.get('companyName'), 160);
    const recipientEmail = cleanText(form.get('recipientEmail'), 254).toLowerCase();
    const position = cleanText(form.get('position'), 180) || 'Poste non renseigné';
    const subject = cleanText(form.get('subject'), 240);
    const coverLetter = cleanText(form.get('coverLetter'), 20000);
    const candidateNameFromForm = cleanText(form.get('candidateName'), 160);

    if (!(cv instanceof File) || cv.size === 0 || cv.size > maxCvBytes) {
      return Response.json({ error: 'Le CV est invalide ou dépasse 10 Mo.' }, { status: 400, headers: corsHeaders });
    }
    if ((!acceptedTypes.has(cv.type) && !acceptedExtensions.test(cv.name)) || !companyId || !companyName || !recipientEmail.includes('@') || !subject) {
      return Response.json({ error: 'Les informations de candidature sont incomplètes ou invalides.' }, { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Configuration Supabase serveur manquante.');
    service = createClient(supabaseUrl, serviceRoleKey);

    const accessToken = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await service.auth.getUser(accessToken);
    if (userError || !user?.email) return Response.json({ error: 'Session invalide. Reconnectez-vous puis réessayez.' }, { status: 401, headers: corsHeaders });

    const candidateName = candidateNameFromForm || String(user.user_metadata?.full_name || user.user_metadata?.name || user.email);
    applicationId = crypto.randomUUID();
    const fileName = safeFileName(cv.name);
    const storagePath = `${user.id}/${applicationId}/${fileName}`;

    const { error: uploadError } = await service.storage.from('candidate-cvs').upload(storagePath, new Uint8Array(await cv.arrayBuffer()), {
      contentType: cv.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploadError) throw new Error(`Impossible d’enregistrer le CV : ${uploadError.message}`);

    const { error: insertError } = await service.from('candidatures').insert({
      id: applicationId,
      user_id: user.id,
      entreprise_id: companyId,
      poste: position,
      statut: 'prepared',
      notes: `Candidature automatique via n8n — CV : ${fileName}`,
      contact_email: recipientEmail,
      candidate_name: candidateName,
      candidate_email: user.email,
      cover_letter: coverLetter,
      cv_bucket: 'candidate-cvs',
      cv_path: storagePath,
      cv_file_name: fileName,
      cv_content_type: cv.type || 'application/octet-stream',
      delivery_status: 'queued',
      date_postulee: new Date().toISOString(),
    });
    if (insertError) {
      await service.storage.from('candidate-cvs').remove([storagePath]);
      throw new Error(`Impossible d’enregistrer la candidature : ${insertError.message}`);
    }

    const n8nUrl = Deno.env.get('N8N_APPLICATION_WEBHOOK_URL');
    const n8nSecret = Deno.env.get('N8N_APPLICATION_WEBHOOK_SECRET');
    if (!n8nUrl || !n8nSecret) {
      const brevoApiKey = Deno.env.get('BREVO_API_KEY');
      const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL');
      if (!brevoApiKey || !brevoSender) {
        await service.from('candidatures').update({ delivery_status: 'failed', delivery_error: 'n8n et Brevo ne sont pas configurés.' }).eq('id', applicationId);
        return Response.json({ applicationId, saved: true, sent: false, error: 'Votre CV, lettre et e-mail sont enregistrés. Configurez n8n ou Brevo pour activer l’envoi automatique.' }, { status: 503, headers: corsHeaders });
      }
      const htmlLetter = escapeHtml(coverLetter).replace(/\n/g, '<br>');
      const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Marrakech Career', email: brevoSender },
          to: [{ email: recipientEmail, name: companyName }],
          replyTo: { email: user.email, name: candidateName },
          subject,
          htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.55">${htmlLetter}<hr><p><strong>Candidat :</strong> ${escapeHtml(candidateName)}<br><strong>E-mail :</strong> ${escapeHtml(user.email)}</p></div>`,
          attachment: [{ content: base64Encode(new Uint8Array(await cv.arrayBuffer())), name: fileName }],
        }),
      });
      if (!brevoResponse.ok) {
        const detail = await brevoResponse.text();
        await service.from('candidatures').update({ delivery_status: 'failed', delivery_error: `Brevo a refusé l’envoi : ${detail.slice(0, 300)}` }).eq('id', applicationId);
        return Response.json({ applicationId, saved: true, sent: false, error: 'Brevo a refusé l’envoi. Vérifiez l’adresse expéditrice dans Brevo.' }, { status: 502, headers: corsHeaders });
      }
      await service.from('candidatures').update({
        statut: 'applied', delivery_status: 'sent', delivery_error: null, sent_at: new Date().toISOString(),
      }).eq('id', applicationId);
      let notificationSent = false;
      let notificationError: string | undefined;
      try {
        await sendMarrakechCareerCopy({
          apiKey: brevoApiKey, senderEmail: brevoSender, candidateName, candidateEmail: user.email,
          companyName, companyEmail: recipientEmail, position, subject, coverLetter, cv, fileName,
        });
        notificationSent = true;
      } catch (error) {
        notificationError = error instanceof Error ? error.message : 'Copie Marrakech Career non envoyée.';
      }
      return Response.json({ applicationId, saved: true, sent: true, provider: 'brevo', notificationSent, notificationError }, { headers: corsHeaders });
    }

    const { data: signedUrl, error: signedUrlError } = await service.storage.from('candidate-cvs').createSignedUrl(storagePath, 60 * 60);
    if (signedUrlError || !signedUrl?.signedUrl) throw new Error('Impossible de préparer le CV pour l’envoi.');

    const aborter = new AbortController();
    const timeout = setTimeout(() => aborter.abort(), 55_000);
    let n8nResponse: Response;
    try {
      n8nResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-marrakech-career-secret': n8nSecret },
        body: JSON.stringify({
          event: 'application.created',
          applicationId,
          candidate: { id: user.id, name: candidateName, email: user.email },
          recipient: { companyId, companyName, email: recipientEmail },
          position,
          subject,
          coverLetter,
          cv: { fileName, contentType: cv.type || 'application/octet-stream', downloadUrl: signedUrl.signedUrl },
        }),
        signal: aborter.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const n8nPayload = await readN8nResult(n8nResponse);
    if (!n8nResponse.ok || n8nPayload.sent === false) {
      const detail = typeof n8nPayload.error === 'string' ? n8nPayload.error : `n8n a répondu avec le statut ${n8nResponse.status}.`;
      await service.from('candidatures').update({ delivery_status: 'failed', delivery_error: detail }).eq('id', applicationId);
      return Response.json({ applicationId, saved: true, sent: false, error: detail }, { status: 502, headers: corsHeaders });
    }

    await service.from('candidatures').update({
      statut: 'applied', delivery_status: 'sent', delivery_error: null, sent_at: new Date().toISOString(),
    }).eq('id', applicationId);
    let notificationSent = false;
    let notificationError: string | undefined;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL');
    if (brevoApiKey && brevoSender) {
      try {
        await sendMarrakechCareerCopy({
          apiKey: brevoApiKey, senderEmail: brevoSender, candidateName, candidateEmail: user.email,
          companyName, companyEmail: recipientEmail, position, subject, coverLetter, cv, fileName,
        });
        notificationSent = true;
      } catch (error) {
        notificationError = error instanceof Error ? error.message : 'Copie Marrakech Career non envoyée.';
      }
    } else {
      notificationError = 'Brevo n’est pas configuré pour la copie Marrakech Career.';
    }
    return Response.json({ applicationId, saved: true, sent: true, notificationSent, notificationError }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de traiter la candidature.';
    if (applicationId && service) await service.from('candidatures').update({ delivery_status: 'failed', delivery_error: message }).eq('id', applicationId);
    return Response.json({ applicationId: applicationId || undefined, saved: Boolean(applicationId), sent: false, error: message }, { status: 500, headers: corsHeaders });
  }
});
