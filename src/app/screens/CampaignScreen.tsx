import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FileText, Mail, Send, Upload, X } from 'lucide-react';
import { useCandidatures } from '../../hooks/useCandidatures';
import { useProfile } from '../../hooks/useProfile';
import { supabase, supabaseUrl } from '../../lib/supabaseClient';
import { CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';

const acceptedCvTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export default function CampaignScreen({ companies, favorites, initialCompanyId, loading, error, onBack }: { companies: Company[]; favorites: Set<number>; initialCompanyId?: number | null; loading: boolean; error: string | null; onBack: () => void }) {
  const favoriteCompanies = useMemo(() => companies.filter((company) => favorites.has(company.id) || company.id === initialCompanyId), [companies, favorites, initialCompanyId]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { profile, email } = useProfile();

  useEffect(() => {
    if (initialCompanyId && favoriteCompanies.some((company) => company.id === initialCompanyId)) setSelected([initialCompanyId]);
  }, [initialCompanyId, favoriteCompanies]);
  const { createCandidature } = useCandidatures();

  const recipients = favoriteCompanies.filter((company) => selected.includes(company.id) && company.email);
  const withoutEmail = favoriteCompanies.filter((company) => selected.includes(company.id) && !company.email);
  const subject = `Candidature — ${profile.job_title || 'opportunité'} — ${profile.full_name || email || 'Candidat'}`;
  const emailBody = message.trim() || `Bonjour,\n\nJe vous contacte afin de vous proposer ma candidature pour ${profile.job_title || 'une opportunité'}.\n\nCordialement,\n${profile.full_name || email || ''}`;

  const toggleCompany = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const selectAll = () => setSelected(favoriteCompanies.filter((company) => Boolean(company.email)).map((company) => company.id));

  const handleCv = (file: File | undefined) => {
    if (!file) return;
    if (!acceptedCvTypes.includes(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name)) return setNotice('Choisissez un CV au format PDF, DOC ou DOCX.');
    if (file.size > 10 * 1024 * 1024) return setNotice('Le CV ne doit pas dépasser 10 Mo.');
    setCv(file);
    setNotice(null);
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
      await Promise.all(recipients.map((company) => createCandidature({ entreprise_id: company.id, poste: profile.job_title || 'Poste non renseigné', statut: 'applied', contact_email: company.email || '', notes: `Campagne n8n — CV : ${cv.name}` })));
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
    <PageHeader title="Campagne de candidatures" sub="Sélectionnez vos favoris, ajoutez votre CV et envoyez une campagne groupée depuis votre Gmail" back onBack={onBack} />
    <CompanyStatus loading={loading} error={error} />
    {notice && <p className="mb-4 rounded-xl border border-[#667436]/40 bg-[#667436]/10 px-4 py-3 text-sm text-[#3d4520]">{notice}</p>}
    {favoriteCompanies.length === 0 ? <div className="rounded-2xl border border-dashed border-[#D6D3D1] bg-white p-10 text-center"><Mail size={28} className="mx-auto mb-3 text-[#A8A29E]" /><p className="font-semibold text-[#1C1917]">Aucune entreprise favorite</p><p className="mt-1 text-sm text-[#78716C]">Ajoutez d’abord les entreprises auxquelles vous souhaitez postuler dans vos favoris.</p></div> : <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 xl:col-span-1"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-bold text-[#1C1917]">Entreprises favorites</h2><p className="text-xs text-[#78716C]">{recipients.length} destinataire{recipients.length > 1 ? 's' : ''} sélectionné{recipients.length > 1 ? 's' : ''}</p></div><button onClick={selectAll} className="text-xs font-bold text-[#621E3E]">Tout sélectionner</button></div><div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">{favoriteCompanies.map((company) => { const hasEmail = Boolean(company.email); return <label key={company.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.includes(company.id) ? 'border-[#621E3E] bg-[#621E3E]/5' : 'border-[#EAE5E0]'} ${!hasEmail ? 'opacity-55' : ''}`}><input type="checkbox" checked={selected.includes(company.id)} disabled={!hasEmail} onChange={() => toggleCompany(company.id)} className="mt-0.5 accent-[#621E3E]" /><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#1C1917]">{company.nom}</span><span className="block truncate text-xs text-[#78716C]">{company.email || 'Adresse e-mail non renseignée'}</span></span></label>; })}</div>{withoutEmail.length > 0 && <p className="mt-3 flex gap-2 text-xs text-[#A16207]"><AlertTriangle size={14} className="shrink-0" />{withoutEmail.length} entreprise{withoutEmail.length > 1 ? 's' : ''} sans adresse e-mail ne seront pas contactées.</p>}</section>
      <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 xl:col-span-2"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1.5 block text-xs font-bold text-[#57534E]">Objet</label><input value={subject} readOnly className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-3 py-2.5 text-sm text-[#57534E]" /></div><div><label className="mb-1.5 block text-xs font-bold text-[#57534E]">CV joint</label><label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#C9C3BD] px-3 py-2.5 text-sm text-[#57534E] hover:border-[#621E3E]"><Upload size={15} /><span className="truncate">{cv ? cv.name : 'Choisir un CV (PDF, DOC ou DOCX)'}</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => handleCv(event.target.files?.[0])} /></label></div></div><label className="mb-1.5 mt-5 block text-xs font-bold text-[#57534E]">Message envoyé à toutes les entreprises sélectionnées</label><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={12} placeholder={emailBody} className="w-full resize-y rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-4 text-sm leading-relaxed text-[#57534E] focus:border-[#621E3E] focus:outline-none" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1EEEB] pt-4"><p className="flex items-center gap-2 text-xs text-[#78716C]"><FileText size={14} /> Le même CV sera joint à chaque e-mail depuis le Gmail connecté.</p><button onClick={requestSend} disabled={sending || recipients.length === 0 || !cv} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"><Send size={15} />{sending ? 'Envoi en cours…' : `Envoyer à ${recipients.length} entreprise${recipients.length > 1 ? 's' : ''}`}</button></div></section>
    </div>}
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-[#1C1917]">Confirmer l’envoi groupé</h2><p className="mt-2 text-sm leading-relaxed text-[#57534E]">Votre message et le fichier « {cv?.name} » seront envoyés à {recipients.length} entreprise{recipients.length > 1 ? 's' : ''} sélectionnée{recipients.length > 1 ? 's' : ''}.</p></div><button onClick={() => setConfirming(false)} className="text-[#78716C]"><X size={18} /></button></div><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirming(false)} className="rounded-xl border border-[#EAE5E0] px-4 py-2 text-sm font-bold text-[#57534E]">Annuler</button><button onClick={() => void sendCampaign()} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-bold text-white"><Check size={15} />Confirmer l’envoi</button></div></div></div>}
  </div>;
}
