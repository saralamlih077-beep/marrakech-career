import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FilePenLine, FileText, Mail, Send, Upload, X } from 'lucide-react';
import { useCandidatures } from '../../hooks/useCandidatures';
import { useProfile } from '../../hooks/useProfile';
import { supabase, supabaseUrl } from '../../lib/supabaseClient';
import { CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';
import type { JobOffer } from '../../hooks/useJobOffers';
import { askGeminiCareerAssistant } from '../../lib/gemini';

const acceptedCvTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export default function CampaignScreen({ companies, favorites, initialCompanyId, initialOffer, loading, error, onBack }: { companies: Company[]; favorites: Set<number>; initialCompanyId?: number | null; initialOffer?: JobOffer | null; loading: boolean; error: string | null; onBack: () => void }) {
  const favoriteCompanies = useMemo(() => initialCompanyId ? companies.filter((company) => company.id === initialCompanyId) : companies.filter((company) => favorites.has(company.id)), [companies, favorites, initialCompanyId]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { profile, email } = useProfile();

  useEffect(() => {
    if (initialCompanyId && favoriteCompanies.some((company) => company.id === initialCompanyId)) setSelected([initialCompanyId]);
  }, [initialCompanyId, favoriteCompanies]);
  const { createCandidature } = useCandidatures();

  const directOfferRecipient = initialOffer && favoriteCompanies.length === 0 && initialOffer.entreprise?.email
    ? { id: initialOffer.entreprise_id, nom: initialOffer.entreprise.nom || 'Entreprise', email: initialOffer.entreprise.email }
    : null;
  const recipients = directOfferRecipient ? [directOfferRecipient] : favoriteCompanies.filter((company) => selected.includes(company.id) && company.email);
  const withoutEmail = favoriteCompanies.filter((company) => selected.includes(company.id) && !company.email);
  const hasApplicationTarget = favoriteCompanies.length > 0 || Boolean(directOfferRecipient);
  const targetTitle = initialOffer?.title || profile.job_title || 'une opportunité';
  const subject = `Candidature — ${targetTitle} — ${profile.full_name || email || 'Candidat'}`;
  const emailBody = message.trim() || `Bonjour,\n\nJe vous contacte afin de vous proposer ma candidature pour ${targetTitle}.\n\nCordialement,\n${profile.full_name || email || ''}`;

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
    if (recipients.length === 0) return setNotice('Cette offre ou entreprise ne possède pas d’adresse e-mail de contact.');
    setGeneratingLetter(true);
    setNotice(null);
    try {
      const company = favoriteCompanies[0];
      const prompt = `Rédige une lettre de motivation professionnelle en français, sans Markdown, prête à envoyer par e-mail. Candidat : ${profile.full_name || email || 'Candidat'}. Profil : ${profile.job_title} ${profile.education} ${profile.experience} ${profile.skills}. Cible : ${initialOffer?.title || 'candidature spontanée'} chez ${company?.nom || recipients[0].name}. Ne mens pas. Maximum 250 mots.`;
      setMessage(await askGeminiCareerAssistant({ message: prompt, companies: [] }));
    } catch (generationError) {
      setNotice(generationError instanceof Error ? `Lettre impossible : ${generationError.message}` : 'Lettre impossible à générer.');
    } finally {
      setGeneratingLetter(false);
    }
  };

  const requestSend = () => {
    if (recipients.length === 0) return setNotice('Sélectionnez au moins une entreprise avec une adresse e-mail.');
    if (!cv) return setNotice('Téléversez votre CV avant l’envoi.');
    setConfirming(true);
  };

  const sendCampaign = async () => {
    if (!cv) return;
    setConfirming(false);
    setSending(true);
    setNotice(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Votre session a expiré. Reconnectez-vous puis réessayez.');

      const payload = new FormData();
      payload.append('cv', cv);
      payload.append('subject', subject);
      payload.append('message', emailBody);
      payload.append('candidates', JSON.stringify(recipients.map((company) => ({ id: company.id, name: company.nom, email: company.email }))));
      payload.append('candidateName', profile.full_name || email || 'Candidat');
      const response = await fetch(`${supabaseUrl}/functions/v1/send-gmail-campaign`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: payload,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Le service Gmail a répondu avec le statut ${response.status}.`);
      await Promise.all(recipients.map((company) => createCandidature({ entreprise_id: company.id, poste: targetTitle, statut: 'applied', contact_email: company.email || '', notes: `Candidature envoyée — CV : ${cv.name}` })));
      setNotice(`${result?.sent ?? recipients.length} e-mail${(result?.sent ?? recipients.length) > 1 ? 's ont' : ' a'} été envoyé${(result?.sent ?? recipients.length) > 1 ? 's' : ''} depuis votre Gmail.`);
      setSelected([]);
      setCv(null);
    } catch (sendError) {
      setNotice(sendError instanceof Error ? `Envoi impossible : ${sendError.message}` : 'Envoi impossible. Connectez votre Gmail dans les paramètres puis réessayez.');
    } finally {
      setSending(false);
    }
  };

  return <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
    <PageHeader title="Candidature" sub={initialCompanyId || initialOffer ? 'Postulez uniquement à l’entreprise ou à l’offre sélectionnée.' : 'Sélectionnez vos favoris, ajoutez votre CV et envoyez une campagne groupée depuis votre Gmail.'} back onBack={onBack} />
    <CompanyStatus loading={loading} error={error} />
    {notice && <p className="mb-4 rounded-xl border border-[#667436]/40 bg-[#667436]/10 px-4 py-3 text-sm text-[#3d4520]">{notice}</p>}
    {!hasApplicationTarget ? <div className="rounded-2xl border border-dashed border-[#D6D3D1] bg-white p-10 text-center"><Mail size={28} className="mx-auto mb-3 text-[#A8A29E]" /><p className="font-semibold text-[#1C1917]">Aucune adresse e-mail disponible</p><p className="mt-1 text-sm text-[#78716C]">Cette offre ou entreprise ne peut pas recevoir une candidature par e-mail pour le moment.</p></div> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 xl:col-span-1"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#1C1917]">{initialCompanyId || initialOffer ? 'Candidature sélectionnée' : 'Entreprises favorites'}</h2><p className="text-xs text-[#78716C]">{recipients.length} destinataire{recipients.length > 1 ? 's' : ''} sélectionné{recipients.length > 1 ? 's' : ''}</p></div>{!(initialCompanyId || initialOffer) && <button onClick={selectAll} className="text-xs font-bold text-[#621E3E]">Tout sélectionner</button>}</div><div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">{directOfferRecipient && <div className="rounded-xl border border-[#621E3E] bg-[#621E3E]/5 p-3"><span className="block text-sm font-semibold text-[#1C1917]">{directOfferRecipient.nom}</span><span className="mt-1 block text-xs text-[#78716C]">{initialOffer?.title}</span><span className="mt-1 block text-xs text-[#78716C]">{directOfferRecipient.email}</span></div>}{favoriteCompanies.map((company) => { const hasEmail = Boolean(company.email); return <label key={company.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.includes(company.id) ? 'border-[#621E3E] bg-[#621E3E]/5' : 'border-[#EAE5E0]'} ${!hasEmail ? 'opacity-55' : ''}`}><input type="checkbox" checked={selected.includes(company.id)} disabled={!hasEmail} onChange={() => toggleCompany(company.id)} className="mt-0.5 accent-[#621E3E]" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#1C1917]">{company.nom}</span><span className="block truncate text-xs text-[#78716C]">{initialOffer?.title || company.email || 'Adresse e-mail non renseignée'}</span></span></label>; })}</div>{withoutEmail.length > 0 && <p className="mt-3 flex gap-2 text-xs text-[#A16207]"><AlertTriangle size={14} className="shrink-0" />{withoutEmail.length} entreprise{withoutEmail.length > 1 ? 's' : ''} sans adresse e-mail ne seront pas contactées.</p>}</section>
      <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 xl:col-span-2"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-[#57534E]">Objet</label><input value={subject} readOnly className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-3 py-2.5 text-sm text-[#57534E]" /></div><div><label className="mb-1.5 block text-xs font-bold text-[#57534E]">CV joint</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#C9C3BD] px-3 py-2.5 text-sm text-[#57534E] hover:border-[#621E3E]"><Upload size={15} /><span className="truncate">{cv ? cv.name : 'Choisir un CV (PDF, DOC ou DOCX)'}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => handleCv(event.target.files?.[0])} /></label></div></div><div className="mt-5 flex items-center justify-between gap-3"><label className="block text-xs font-bold text-[#57534E]">Lettre de motivation / message</label><button type="button" onClick={() => void generateLetter()} disabled={!cv || generatingLetter || recipients.length === 0} className="flex items-center gap-1.5 rounded-lg border border-[#C6C954]/50 bg-[#C6C954]/10 px-3 py-1.5 text-xs font-bold text-[#4a4d1a] disabled:opacity-45"><FilePenLine size={13} />{generatingLetter ? 'Génération…' : 'Générer la lettre'}</button></div><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={12} placeholder={emailBody} className="mt-1.5 w-full resize-y rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-4 text-sm leading-relaxed text-[#57534E] focus:border-[#621E3E] focus:outline-none" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1EEEB] pt-4"><p className="flex items-center gap-2 text-xs text-[#78716C]"><FileText size={14} /> Le CV et la lettre seront envoyés depuis le Gmail connecté.</p><button onClick={requestSend} disabled={sending || recipients.length === 0 || !cv} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"><Send size={15} />{sending ? 'Envoi en cours…' : `Envoyer à ${recipients.length} entreprise${recipients.length > 1 ? 's' : ''}`}</button></div></section>
    </div>}
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-[#1C1917]">Confirmer l’envoi groupé</h2><p className="mt-2 text-sm leading-relaxed text-[#57534E]">Votre message et le fichier « {cv?.name} » seront envoyés à {recipients.length} entreprise{recipients.length > 1 ? 's' : ''} sélectionnée{recipients.length > 1 ? 's' : ''}.</p></div><button onClick={() => setConfirming(false)} className="text-[#78716C]"><X size={18} /></button></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirming(false)} className="rounded-xl border border-[#EAE5E0] px-4 py-2 text-sm font-bold text-[#57534E]">Annuler</button><button onClick={() => void sendCampaign()} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-bold text-white"><Check size={15} />Confirmer l’envoi</button></div></div></div>}
  </div>;
}
