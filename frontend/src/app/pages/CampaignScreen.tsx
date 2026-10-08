import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FilePenLine, FileText, Mail, Send, Upload, X } from 'lucide-react';
import { usePersonalGmail } from '../../hooks/usePersonalGmail';
import GmailConnectionPanel from '../components/GmailConnectionPanel';
import { useProfile } from '../../hooks/useProfile';
import { supabase, supabaseUrl } from '../../lib/supabaseClient';
import { CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';
import type { JobOffer } from '../../hooks/useJobOffers';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { offerEmployerName } from '../offerSources';
import { isDefinitiveSubmissionRejection } from '../applicationDelivery';

const acceptedCvTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const applicationTypes = ['Stage', 'CDI', 'CDD', 'Freelance', 'Temps plein', 'Candidature spontanée'] as const;

function initialApplicationType(offer?: JobOffer | null) {
  if (offer?.contract_type === 'internship') return 'Stage';
  if (offer?.contract_type === 'cdi') return 'CDI';
  if (offer?.contract_type === 'cdd') return 'CDD';
  if (offer?.contract_type === 'freelance') return 'Freelance';
  if (offer?.contract_type === 'full_time') return 'Temps plein';
  return 'Candidature spontanée';
}

export default function CampaignScreen({ companies, favorites, initialCompanyId, initialOffer, loading, error, onBack }: { companies: Company[]; favorites: Set<number>; initialCompanyId?: number | null; initialOffer?: JobOffer | null; loading: boolean; error: string | null; onBack: () => void }) {
  const favoriteCompanies = useMemo(() => initialCompanyId ? companies.filter((company) => company.id === initialCompanyId) : companies.filter((company) => favorites.has(company.id)), [companies, favorites, initialCompanyId]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [applicationType, setApplicationType] = useState<(typeof applicationTypes)[number]>(() => initialApplicationType(initialOffer));
  const [cv, setCv] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { profile, email } = useProfile();

  useEffect(() => {
    if (initialCompanyId && favoriteCompanies.some((company) => company.id === initialCompanyId)) setSelected([initialCompanyId]);
  }, [initialCompanyId, favoriteCompanies]);
  const gmail = usePersonalGmail();
  const [pendingJob, setPendingJob] = useState<string | null>(null);
  const [checkVersion, setCheckVersion] = useState(0);

  const directOfferRecipient = initialOffer && favoriteCompanies.length === 0 && (initialOffer.contact_email || initialOffer.entreprise?.email)
    ? { id: initialOffer.entreprise_id, nom: offerEmployerName(initialOffer), email: initialOffer.contact_email || initialOffer.entreprise?.email }
    : null;
  const recipients = directOfferRecipient ? [directOfferRecipient] : favoriteCompanies.filter((company) => selected.includes(company.id) && company.email);
  const withoutEmail = favoriteCompanies.filter((company) => selected.includes(company.id) && !company.email);
  const hasApplicationTarget = favoriteCompanies.length > 0 || Boolean(initialOffer);
  const targetTitle = initialOffer?.title || profile.job_title || 'une opportunité';
  const subject = `Candidature ${applicationType} — ${targetTitle} — ${profile.full_name || email || 'Candidat'}`;
  const emailBody = message.trim() || `Bonjour,\n\nJe vous contacte afin de vous proposer ma candidature de ${applicationType.toLowerCase()} pour ${targetTitle}.\n\nCordialement,\n${profile.full_name || email || ''}`;

  const toggleCompany = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectAll = () => setSelected(favoriteCompanies.filter((company) => Boolean(company.email)).map((company) => company.id));

  const handleCv = (file: File | undefined) => {
    if (!file) return;
    if (!acceptedCvTypes.includes(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name)) return setNotice('Choisissez un CV au format PDF, DOC ou DOCX.');
    if (file.size > 10 * 1024 * 1024) return setNotice('Le CV ne doit pas dépasser 10 Mo.');
    setCv(file);
    setNotice(null);
  };

  const generateLetter = async () => {
    if (!cv) return setNotice('Téléversez votre CV avant de générer la lettre.');
    if (favoriteCompanies.length === 0 && !initialOffer) return setNotice('Choisissez une entreprise ou une offre avant de générer la lettre.');
    setGeneratingLetter(true);
    setNotice(null);
    try {
      const company = favoriteCompanies[0];
      const prompt = `Rédige une lettre de motivation professionnelle en français, sans Markdown, prête à envoyer par e-mail. Type de candidature demandé : ${applicationType}. Candidat : ${profile.full_name || email || 'Candidat'}. Profil : ${profile.job_title} ${profile.education} ${profile.experience} ${profile.skills}. Cible : ${initialOffer?.title || 'candidature spontanée'} chez ${company?.nom || (initialOffer ? offerEmployerName(initialOffer) : 'l’entreprise ciblée')}. Ne mens pas. Maximum 250 mots.`;
      setMessage(await askGeminiCareerAssistant({ message: prompt, companies: [] }));
    } catch (generationError) {
      setNotice(generationError instanceof Error ? `Lettre impossible : ${generationError.message}` : 'Lettre impossible à générer.');
    } finally {
      setGeneratingLetter(false);
    }
  };

  const requestSend = () => {
    if (!gmail.connected || !gmail.deliveryReady || pendingJob) return setNotice('Connectez votre Gmail et attendez la disponibilité du service avant d’envoyer.');
    if (recipients.length === 0) return setNotice('Sélectionnez au moins une entreprise avec une adresse e-mail.');
    if (!cv) return setNotice('Téléversez votre CV avant l’envoi.');
    setConfirming(true);
  };

  const campaignRequest = async (body: FormData | Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Votre session a expiré. Reconnectez-vous.');
    const isForm = body instanceof FormData;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-gmail-campaign`, {
      method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, ...(isForm ? {} : { 'Content-Type': 'application/json' }) },
      body: isForm ? body : JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(result?.error || 'Le suivi de l’envoi est indisponible.'), { status: response.status });
    return result;
  };

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      const cached = sessionStorage.getItem('mc-gmail-pending-job');
      if (!cached || !active) return;
      try {
        const saved = JSON.parse(cached);
        if (saved.userId === data.session?.user.id && typeof saved.jobId === 'string') setPendingJob(saved.jobId);
      } catch { sessionStorage.removeItem('mc-gmail-pending-job'); }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!pendingJob) return;
    let active = true;
    let timer: number | undefined;
    let attempts = 0;
    const check = async () => {
      try {
        const result = await campaignRequest({ action: 'status', jobId: pendingJob });
        if (!active) return;
        if (['done', 'failed', 'unknown'].includes(result.status)) {
          const sent = result.sent || 0;
          setNotice(`${sent} candidature${sent > 1 ? 's' : ''} confirmée${sent > 1 ? 's' : ''} depuis ${result.senderEmail}. ${result.failed ? `${result.failed} envoi(s) ont échoué. ` : ''}${result.unknown || result.status === 'unknown' ? 'Vérifiez Messages envoyés dans Gmail avant de réessayer les envois sans confirmation.' : result.error || (sent ? 'Retrouvez les messages dans Messages envoyés de ce Gmail.' : 'Aucun envoi n’a été confirmé.')}`);
          sessionStorage.removeItem('mc-gmail-pending-job');
          setPendingJob(null); setSending(false); setSelected([]); setCv(null);
          return;
        }
      } catch (e) {
        if (active && e instanceof Error && 'status' in e && e.status === 404) {
          const cached = sessionStorage.getItem('mc-gmail-pending-job');
          let startedAt = NaN;
          try { startedAt = cached ? Number(JSON.parse(cached).startedAt) : NaN; } catch { /* Keep uncertain submissions blocked. */ }
          if (Number.isFinite(startedAt) && Date.now() - startedAt > 15 * 60 * 1000) {
            sessionStorage.removeItem('mc-gmail-pending-job'); setPendingJob(null); setSending(false);
            setNotice('Suivi introuvable. Vérifiez vos Messages envoyés avant de relancer cette candidature.'); return;
          }
        }
        if (active && attempts > 3) setNotice(e instanceof Error ? e.message : 'Suivi indisponible.');
      }
      if (!active) return;
      if (++attempts >= 60) { setSending(false); setNotice('Confirmation encore en attente. Actualisez le suivi avant de renvoyer cette candidature.'); return; }
      timer = window.setTimeout(() => void check(), 2000);
    };
    setSending(true); void check();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [pendingJob, checkVersion]);

  const sendCampaign = async () => {
    if (!cv || pendingJob || sending || !gmail.connected || !gmail.deliveryReady) return;
    setConfirming(false); setSending(true); setNotice(null);
    const requestId = crypto.randomUUID();
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('Votre session a expiré.');
      sessionStorage.setItem('mc-gmail-pending-job', JSON.stringify({ userId: data.session.user.id, jobId: requestId, startedAt: Date.now() }));
      const payload = new FormData();
      payload.append('requestId', requestId); payload.append('cv', cv); payload.append('subject', subject);
      payload.append('message', emailBody); payload.append('position', targetTitle);
      payload.append('candidates', JSON.stringify(recipients.map(company => ({ id: company.id, name: company.nom, email: company.email }))));
      try {
        const result = await campaignRequest(payload);
        setPendingJob(result.jobId); setNotice('Candidature enregistrée. Attente de la confirmation d’envoi depuis votre Gmail…');
      } catch (e) {
        if (e instanceof Error && 'status' in e && isDefinitiveSubmissionRejection(e.status)) { sessionStorage.removeItem('mc-gmail-pending-job'); throw e; }
        // Connection loss can happen after acceptance. Keep the same job; never submit it twice.
        setPendingJob(requestId); setNotice('Connexion interrompue. Vérification de cet envoi avant toute nouvelle candidature.');
      }
    } catch (e) { setSending(false); setNotice(e instanceof Error ? e.message : 'Envoi impossible.'); }
  };

  return <div className="flex-1 overflow-auto p-4 sm:p-8 bg-[#FBF9F7]">
    <PageHeader title="Candidature" sub={initialCompanyId || initialOffer ? 'Postulez uniquement à l’entreprise ou à l’offre sélectionnée.' : 'Sélectionnez vos favoris, ajoutez votre CV et envoyez une campagne groupée depuis votre Gmail.'} back onBack={onBack} />
    <GmailConnectionPanel gmail={gmail} registrationEmail={email} disabled={sending || Boolean(pendingJob)} />
    {pendingJob && <div role="status" className="mb-4 rounded-xl border border-[#C6C954]/50 bg-[#C6C954]/10 p-4 text-sm text-[#57534E]">Une candidature attend sa confirmation. Aucun nouvel envoi ne sera effectué tant que son statut reste incertain.<button type="button" onClick={() => setCheckVersion(v => v + 1)} className="ml-3 font-bold text-[#621E3E]">Actualiser le suivi</button></div>}
    {gmail.connected && <div className="mb-4 max-w-sm rounded-2xl border border-[#EAE5E0] bg-white p-4">
      <label htmlFor="application-type" className="mb-1.5 block text-sm font-bold text-[#1C1917]">Type de candidature</label>
      <p className="mb-3 text-xs text-[#78716C]">Ce choix sera utilisé pour générer votre lettre de motivation.</p>
      <select
        id="application-type"
        value={applicationType}
        onChange={(event) => { setApplicationType(event.target.value as (typeof applicationTypes)[number]); setMessage(''); }}
        className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-3 py-2.5 text-sm text-[#57534E] focus:border-[#621E3E] focus:outline-none"
      >
        {applicationTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
    </div>}
    <CompanyStatus loading={loading} error={error} />
    {notice && <p role="status" className="fixed bottom-6 right-6 z-[60] max-w-md rounded-xl border border-[#667436]/40 bg-white px-4 py-3 text-sm text-[#3d4520] shadow-xl">{notice}</p>}
    {!gmail.connected ? <p className="rounded-xl bg-white p-5 text-sm text-[#78716C]">Après l’autorisation Google, vous pourrez joindre votre CV et confirmer votre candidature ici.</p> : !hasApplicationTarget ? <div className="rounded-2xl border border-dashed border-[#D6D3D1] bg-white p-10 text-center"><Mail size={28} className="mx-auto mb-3 text-[#A8A29E]" /><p className="font-semibold text-[#1C1917]">Aucune adresse e-mail disponible</p><p className="mt-1 text-sm text-[#78716C]">Cette offre ou entreprise ne peut pas recevoir une candidature par e-mail pour le moment.</p></div> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 xl:col-span-1"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#1C1917]">{initialCompanyId || initialOffer ? 'Candidature sélectionnée' : 'Entreprises favorites'}</h2><p className="text-xs text-[#78716C]">{recipients.length} destinataire{recipients.length > 1 ? 's' : ''} sélectionné{recipients.length > 1 ? 's' : ''}</p></div>{!(initialCompanyId || initialOffer) && <button onClick={selectAll} className="text-xs font-bold text-[#621E3E]">Tout sélectionner</button>}</div><div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">{directOfferRecipient && <div className="rounded-xl border border-[#621E3E] bg-[#621E3E]/5 p-3"><span className="block text-sm font-semibold text-[#1C1917]">{directOfferRecipient.nom}</span><span className="mt-1 block text-xs text-[#78716C]">{initialOffer?.title}</span><span className="mt-1 block text-xs text-[#78716C]">{directOfferRecipient.email}</span></div>}{initialOffer && !directOfferRecipient && favoriteCompanies.length === 0 && <div className="rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-3"><span className="block text-sm font-semibold text-[#1C1917]">{initialOffer.title}</span><span className="mt-1 block text-xs text-[#A16207]">Aucune adresse e-mail : la lettre peut être générée, mais pas envoyée.</span></div>}{favoriteCompanies.map((company) => { const hasEmail = Boolean(company.email); return <label key={company.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.includes(company.id) ? 'border-[#621E3E] bg-[#621E3E]/5' : 'border-[#EAE5E0]'} ${!hasEmail ? 'opacity-55' : ''}`}><input type="checkbox" checked={selected.includes(company.id)} disabled={!hasEmail} onChange={() => toggleCompany(company.id)} className="mt-0.5 accent-[#621E3E]" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#1C1917]">{company.nom}</span><span className="block truncate text-xs text-[#78716C]">{initialOffer?.title || company.email || 'Adresse e-mail non renseignée'}</span></span></label>; })}</div>{withoutEmail.length > 0 && <p className="mt-3 flex gap-2 text-xs text-[#A16207]"><AlertTriangle size={14} className="shrink-0" />{withoutEmail.length} entreprise{withoutEmail.length > 1 ? 's' : ''} sans adresse e-mail ne seront pas contactées.</p>}</section>
      <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 xl:col-span-2"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-[#57534E]">Objet</label><input value={subject} readOnly className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-3 py-2.5 text-sm text-[#57534E]" /></div><div><label className="mb-1.5 block text-xs font-bold text-[#57534E]">CV joint</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#C9C3BD] px-3 py-2.5 text-sm text-[#57534E] hover:border-[#621E3E]"><Upload size={15} /><span className="truncate">{cv ? cv.name : 'Choisir un CV (PDF, DOC ou DOCX)'}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => handleCv(event.target.files?.[0])} /></label></div></div><div className="mt-5 flex items-center justify-between gap-3"><label className="block text-xs font-bold text-[#57534E]">Lettre de motivation / message</label><button type="button" onClick={() => void generateLetter()} disabled={!cv || generatingLetter} className="flex items-center gap-1.5 rounded-lg border border-[#C6C954]/50 bg-[#C6C954]/10 px-3 py-1.5 text-xs font-bold text-[#4a4d1a] disabled:opacity-45"><FilePenLine size={13} />{generatingLetter ? 'Génération…' : 'Générer la lettre'}</button></div><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={12} placeholder={emailBody} className="mt-1.5 w-full resize-y rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-4 text-sm leading-relaxed text-[#57534E] focus:border-[#621E3E] focus:outline-none" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1EEEB] pt-4"><p className="flex items-center gap-2 text-xs text-[#78716C]"><FileText size={14} /> Le CV et la lettre seront envoyés depuis le Gmail connecté.</p><button onClick={requestSend} disabled={sending || Boolean(pendingJob) || !gmail.deliveryReady || recipients.length === 0 || !cv} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"><Send size={15} />{sending ? 'Envoi en cours…' : `Envoyer à ${recipients.length} entreprise${recipients.length > 1 ? 's' : ''}`}</button></div></section>
    </div>}
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-[#1C1917]">Confirmer l’envoi groupé</h2><p className="mt-2 text-sm leading-relaxed text-[#57534E]">Depuis {gmail.email}, votre message et le fichier « {cv?.name} » seront envoyés à {recipients.length} entreprise{recipients.length > 1 ? 's' : ''} sélectionnée{recipients.length > 1 ? 's' : ''}.</p></div><button onClick={() => setConfirming(false)} className="text-[#78716C]"><X size={18} /></button></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirming(false)} className="rounded-xl border border-[#EAE5E0] px-4 py-2 text-sm font-bold text-[#57534E]">Annuler</button><button onClick={() => void sendCampaign()} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-bold text-white"><Check size={15} />Confirmer l’envoi</button></div></div></div>}
  </div>;
}
