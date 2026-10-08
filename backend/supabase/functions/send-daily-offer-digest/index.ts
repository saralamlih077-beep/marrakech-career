// Cron only. Auth addresses remain server-side; never accept a recipient from a client.
type Offer = { id: string; title: string; location: string; contract: string; employer: string; source: string; source_url?: string };
const APP = 'https://marrakech-career.vercel.app/';
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
export function safeUrl(value: unknown): string | null {
  try { const url = new URL(String(value)); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function digestEmail(offers: Offer[], recipientName = '') {
  const subject = `${offers.length} nouvelle${offers.length>1?'s':''} offre${offers.length>1?'s':''} · Marrakech Career`;
  const firstName = recipientName.trim().split(/\s+/)[0]?.slice(0, 60) || '';
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const lines = offers.map(o => {
    const appLink = `${APP}?offer=${encodeURIComponent(o.id)}`;
    const sourceLink = safeUrl(o.source_url);
    return `<tr><td style="padding:0 0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #EAE5E0;border-radius:16px;background:#FFFFFF"><tr><td style="padding:22px;word-break:break-word"><h2 style="margin:0 0 12px;font-size:21px;line-height:1.4;color:#1C1917">${escapeHtml(o.title)}</h2><p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:#57534E">Entreprise : ${escapeHtml(o.employer || 'Entreprise non précisée')}</p><p style="margin:0 0 6px;font-size:16px;line-height:1.5;color:#57534E">${escapeHtml(o.location || 'Marrakech')}${o.contract ? ` · ${escapeHtml(o.contract)}` : ''}</p><p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#78716C">Source : ${escapeHtml(o.source)}</p><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#621E3E" style="border-radius:10px;background:#621E3E"><a href="${escapeHtml(appLink)}" style="display:inline-block;padding:13px 20px;color:#FFFFFF;font-size:16px;font-weight:bold;text-decoration:none">Voir l’offre</a></td></tr></table>${sourceLink?`<p style="margin:14px 0 0;font-size:13px"><a href="${escapeHtml(sourceLink)}" style="color:#621E3E;text-decoration:underline">Annonce d’origine</a></p>`:''}</td></tr></table></td></tr>`;
  });
  return {subject,
    htmlContent:`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#FBF9F7;color:#1C1917;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#FBF9F7"><tr><td align="center" style="padding:24px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:620px"><tr><td bgcolor="#621E3E" style="padding:28px 24px;border-radius:20px;background:#621E3E"><h1 style="margin:0 0 8px;font-size:30px;line-height:1.2;color:#FFFFFF">Marrakech Career</h1><p style="margin:0;font-size:19px;line-height:1.4;font-weight:bold;color:#E3E69B">NOUVELLES OFFRES</p></td></tr><tr><td style="padding:28px 4px 20px"><p style="margin:0 0 16px;font-size:20px;line-height:1.5">${escapeHtml(greeting)}</p><p style="margin:0;font-size:18px;line-height:1.7;color:#57534E">Voici ${offers.length === 1 ? 'la' : 'les'} <strong>${offers.length} nouvelle${offers.length>1?'s':''} offre${offers.length>1?'s':''}</strong> disponible${offers.length>1?'s':''} à Marrakech :</p></td></tr><tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%">${lines.join('')}</table></td></tr><tr><td style="padding:8px 4px;font-size:12px;line-height:1.7;color:#78716C">Vous recevez cet e-mail car vous avez activé les alertes sur Marrakech Career. Pour vous désabonner, <a href="${APP}?alerts=manage" style="color:#621E3E">gérez vos alertes sur la page Offres</a>. Aucun e-mail n’est envoyé lorsqu’il n’y a pas de nouvelle offre.</td></tr></table></td></tr></table></body></html>`,
    textContent:`${greeting}\n\n${subject}\n\n${offers.map(o=>`${o.title}\n${o.employer} · ${o.location}\n${o.contract} · Source : ${o.source}\n${APP}?offer=${encodeURIComponent(o.id)}${safeUrl(o.source_url)?`\n${safeUrl(o.source_url)}`:''}`).join('\n\n')}\n\nPour désactiver les alertes : ${APP}?alerts=manage (page Offres).`,
  };
}
export function eligibleUser(user: {email?: string; email_confirmed_at?: string; banned_until?: string; deleted_at?: string} | null, now=Date.now()) {
  return Boolean(user?.email && user.email_confirmed_at && !user.deleted_at && (!user.banned_until || Date.parse(user.banned_until)<=now));
}
export function failureStatus(httpStatus: number): 'failed'|'unknown' {
  // A server error/timeout could happen after acceptance. Never resend these offers automatically.
  return httpStatus>=400 && httpStatus<500 ? 'failed' : 'unknown';
}
export async function runDigest(service: any, mailer: (recipient: string, digest: {id:string;offers:Offer[];recipientName?:string})=>Promise<{status:number;messageId?:string}>, dryRun: boolean) {
  const result = {dryRun, subscribers:0, eligible:0, plannedRecipients:0, plannedOffers:0, sent:0, skipped:0, failed:0, unknown:0};
  // Page through explicit subscriptions, not the first 1,000 Auth accounts.
  let after: string | null = null;
  const started = Date.now();
  for (;;) {
    let query = service.from('job_alert_preferences').select('user_id').eq('enabled',true).order('user_id').limit(100);
    if (after) query=query.gt('user_id',after);
    const {data:preferences,error}=await query;
    if (error) throw new Error('preferences_unavailable');
    if (!preferences?.length) break;
    for (const pref of preferences) {
      // Leave enough time for ledger completion before the hosted worker's limit.
      if (Date.now()-started>100000) throw new Error('digest_runtime_limit');
      after=pref.user_id; result.subscribers++;
      const {data:auth,error:authError}=await service.auth.admin.getUserById(pref.user_id);
      if (authError || !eligibleUser(auth?.user)) { result.skipped++; continue; }
      result.eligible++;
      if (dryRun) {
        const {data:offers,error:previewError}=await service.rpc('preview_job_alert_digest',{p_user_id:pref.user_id});
        if (previewError) throw new Error('digest_preview_failed');
        if (offers?.length) { result.plannedRecipients++; result.plannedOffers+=offers.length; }
        else result.skipped++;
        continue;
      }
      const {data:digest,error:claimError}=await service.rpc('claim_job_alert_digest',{p_user_id:pref.user_id});
      if (claimError) throw new Error('digest_claim_failed');
      if (!digest) { result.skipped++; continue; }
      const finish=async(status:string,messageId:string|null=null,errorCode:string|null=null)=>{
        const {error}=await service.rpc('finish_job_alert_digest',{p_digest:digest.id,p_status:status,p_message_id:messageId,p_error_code:errorCode});
        if (error) throw new Error('digest_audit_failed');
      };
      const {data:current,error:prefError}=await service.from('job_alert_preferences').select('enabled').eq('user_id',pref.user_id).maybeSingle();
      if (prefError) { await finish('cancelled',null,'preference_check_failed'); result.skipped++; continue; }
      if (current?.enabled!==true) { await finish('cancelled',null,'opted_out'); result.skipped++; continue; }
      let response;
      try {
        const metadata = auth.user.user_metadata || {};
        const recipientName = [metadata.first_name, metadata.full_name, metadata.name].find(value => typeof value === 'string' && value.trim()) || '';
        response=await mailer(auth.user.email,{...digest,recipientName});
      }
      catch { await finish('unknown',null,'provider_network_error'); result.unknown++; continue; }
      if (response.status>=200 && response.status<300 && response.messageId) {
        await finish('sent',response.messageId); result.sent++;
      } else {
        const status=failureStatus(response.status);
        await finish(status,null,`provider_http_${response.status}`); result[status]++;
        // Stop on account/rate-limit problems instead of exhausting every subscriber's reservation.
        if ([401,402,403,429].includes(response.status)) return result;
      }
    }
    if (preferences.length<100) break;
  }
  return result;
}

if (typeof Deno !== 'undefined') Deno.serve(async(request: Request)=>{
  if (request.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  const secret=Deno.env.get('JOOBLE_SYNC_SECRET')||Deno.env.get('JOBSQUARE_SYNC_SECRET');
  if (!secret || request.headers.get('x-cron-secret')!==secret) return Response.json({error:'Unauthorized'},{status:403});
  try {
    const body=await request.json().catch(()=>({}));
    const dryRun=body.dryRun===true;
    const key=Deno.env.get('BREVO_API_KEY'); const sender=Deno.env.get('BREVO_SENDER_EMAIL');
    if (!key || !sender) return Response.json({error:'brevo_configuration_missing'},{status:503});
    const providerHeaders={'api-key':key,'content-type':'application/json','accept':'application/json'};
    const accountResponse=await fetch('https://api.brevo.com/v3/account',{headers:providerHeaders,signal:AbortSignal.timeout(10000)});
    if (!accountResponse.ok) return Response.json({error:'brevo_account_unavailable',providerStatus:accountResponse.status},{status:503});
    const account=await accountResponse.json();
    const smtpEnabled=account.relay?.enabled===true;
    if (!smtpEnabled) return Response.json({error:'brevo_transactional_email_disabled'},{status:503});
    const sendersResponse=await fetch('https://api.brevo.com/v3/senders',{headers:providerHeaders,signal:AbortSignal.timeout(10000)});
    if (!sendersResponse.ok) return Response.json({error:'brevo_account_unavailable',providerStatus:sendersResponse.status},{status:503});
    const senders=await sendersResponse.json();
    const senderVerified=(senders.senders||[]).some((s:any)=>s.email?.toLowerCase()===sender.toLowerCase() && s.active===true);
    if (!senderVerified) return Response.json({error:'brevo_sender_not_verified'},{status:503});
    const {createClient}=await import('npm:@supabase/supabase-js@2');
    const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const mailer=async(recipient:string,digest:{id:string;offers:Offer[];recipientName?:string},sandbox=false)=>{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',headers:providerHeaders,signal:AbortSignal.timeout(15000),
        body:JSON.stringify({sender:{name:'Marrakech Career',email:sender},to:[{email:recipient}],
          ...digestEmail(digest.offers,digest.recipientName),headers:{idempotencyKey:digest.id,...(sandbox?{'X-Sib-Sandbox':'drop'}:{})},tags:['daily-offer-digest']})
      });
      const data=await response.json().catch(()=>({}));
      return {status:response.status,messageId:data.messageId};
    };
    let sandboxValidated: boolean | undefined;
    if (dryRun && body.verifyProvider===true) {
      const check=await mailer('delivery-check@example.com',{id:crypto.randomUUID(),offers:[{id:crypto.randomUUID(),title:'Test de configuration',employer:'Entreprise de démonstration',location:'Marrakech',contract:'Stage',source:'Test'}]},true);
      sandboxValidated=check.status===201 && Boolean(check.messageId);
      if (!sandboxValidated) return Response.json({error:'brevo_sandbox_validation_failed',providerStatus:check.status},{status:503});
    }
    const result=await runDigest(service,mailer,dryRun);
    return Response.json({...result,smtpEnabled,senderVerified,sandboxValidated},{status:result.failed||result.unknown?503:200});
  } catch(error) {
    // Do not include Auth addresses, API keys or raw provider responses in logs.
    console.error('Daily offer digest failed',error instanceof Error ? error.name:'Error');
    return Response.json({error:'daily_digest_failed'},{status:500});
  }
});
