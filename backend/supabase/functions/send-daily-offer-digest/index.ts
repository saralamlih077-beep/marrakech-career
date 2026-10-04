// Cron only. Auth addresses remain server-side; never accept a recipient from a client.
type Offer = { id: string; title: string; location: string; contract: string; employer: string; source: string; source_url?: string };
const APP = 'https://marrakech-career.vercel.app/';
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
export function safeUrl(value: unknown): string | null {
  try { const url = new URL(String(value)); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function digestEmail(offers: Offer[]) {
  const subject = `${offers.length} nouvelle${offers.length>1?'s':''} offre${offers.length>1?'s':''} · Marrakech Career`;
  const lines = offers.map(o => {
    const appLink = `${APP}?offer=${encodeURIComponent(o.id)}`;
    const sourceLink = safeUrl(o.source_url);
    return `<tr><td style="padding:18px 0;border-bottom:1px solid #EAE5E0"><strong>${escapeHtml(o.title)}</strong><br>${escapeHtml(o.employer)} · ${escapeHtml(o.location)}<br><small>${escapeHtml(o.contract)} · Source : ${escapeHtml(o.source)}</small><br><a href="${escapeHtml(appLink)}" style="color:#621E3E">Voir dans Marrakech Career</a>${sourceLink?` · <a href="${escapeHtml(sourceLink)}" style="color:#621E3E">Annonce d’origine</a>`:''}</td></tr>`;
  });
  return {subject,
    htmlContent:`<!doctype html><html lang="fr"><body style="margin:0;background:#FBF9F7;color:#1C1917;font-family:Arial,sans-serif"><div style="max-width:620px;margin:24px auto;padding:24px;background:white;border-radius:16px"><h1 style="font-size:22px;color:#621E3E">Marrakech Career</h1><p>Bonjour,</p><p>Voici vos nouvelles offres, regroupées dans votre récapitulatif quotidien.</p><table role="presentation" style="width:100%;border-collapse:collapse">${lines.join('')}</table><p style="font-size:12px;color:#78716C">Vous recevez cet e-mail car vous avez activé les alertes. Pour vous désabonner, <a href="${APP}?alerts=manage">ouvrez la page Offres</a> et désactivez « Alertes activées ». Aucun e-mail n’est envoyé lorsqu’il n’y a pas de nouvelle offre.</p></div></body></html>`,
    textContent:`Bonjour,\n\n${subject}\n\n${offers.map(o=>`${o.title}\n${o.employer} · ${o.location}\n${o.contract} · Source : ${o.source}\n${APP}?offer=${encodeURIComponent(o.id)}${safeUrl(o.source_url)?`\n${safeUrl(o.source_url)}`:''}`).join('\n\n')}\n\nPour désactiver les alertes : ${APP}?alerts=manage (page Offres).`,
  };
}
export function eligibleUser(user: {email?: string; email_confirmed_at?: string; banned_until?: string; deleted_at?: string} | null, now=Date.now()) {
  return Boolean(user?.email && user.email_confirmed_at && !user.deleted_at && (!user.banned_until || Date.parse(user.banned_until)<=now));
}
export function failureStatus(httpStatus: number): 'failed'|'unknown' {
  // A server error/timeout could happen after acceptance. Never resend these offers automatically.
  return httpStatus>=400 && httpStatus<500 ? 'failed' : 'unknown';
}
export async function runDigest(service: any, mailer: (recipient: string, digest: {id:string;offers:Offer[]})=>Promise<{status:number;messageId?:string}>, dryRun: boolean) {
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
      try { response=await mailer(auth.user.email,digest); }
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
    const mailer=async(recipient:string,digest:{id:string;offers:Offer[]},sandbox=false)=>{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',headers:providerHeaders,signal:AbortSignal.timeout(15000),
        body:JSON.stringify({sender:{name:'Marrakech Career',email:sender},to:[{email:recipient}],
          ...digestEmail(digest.offers),headers:{idempotencyKey:digest.id,...(sandbox?{'X-Sib-Sandbox':'drop'}:{})},tags:['daily-offer-digest']})
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
