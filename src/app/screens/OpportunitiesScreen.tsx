import { Bell, BriefcaseBusiness, CalendarClock, Copy, ExternalLink, FilePenLine, Heart, Mail, Map, MapPin, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useJobOffers, type JobOffer } from '../../hooks/useJobOffers';
import { useProfile } from '../../hooks/useProfile';
import { useFavorites } from '../../hooks/useFavorites';
import { matchColor } from '../utils';
import { SkillTag } from '../components/shared';
import type { NavPage } from '../types';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { supabase } from '../../lib/supabaseClient';

const labels: Record<JobOffer['contract_type'], string> = {
  internship: 'Stage', cdi: 'CDI', cdd: 'CDD', freelance: 'Freelance',
};

function terms(value: string) {
  return new Set(value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9+#.]+/).filter(word => word.length > 2));
}

function offerScore(offer: JobOffer, profileText: string) {
  const candidateTerms = terms(profileText);
  if (!candidateTerms.size) return 0;
  const skillText = offer.skills.join(' ');
  const offerText = `${offer.title} ${offer.description} ${offer.requirements} ${skillText}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const matchingSkills = offer.skills.filter(skill => offerText.includes(skill.toLocaleLowerCase()) && [...candidateTerms].some(term => skill.toLocaleLowerCase().includes(term) || term.includes(skill.toLocaleLowerCase()))).length;
  const matchedTerms = [...candidateTerms].filter(term => offerText.includes(term)).length;
  return Math.min(100, Math.round(Math.min(matchedTerms, 8) * 9 + Math.min(matchingSkills, 5) * 8));
}

function expiryLabel(expiresAt: string | null) {
  if (!expiresAt) return 'Expiration non indiquée';
  return `Expire le ${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(expiresAt))}`;
}

export default function OpportunitiesScreen({ onNavigate }: { onNavigate: (page: NavPage) => void }) {
  const { offers, loading, error } = useJobOffers();
  const { profile } = useProfile();
  const { favorites, toggleFavorite } = useFavorites();
  const [letterOffer, setLetterOffer] = useState<JobOffer | null>(null);
  const [letter, setLetter] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const profileText = `${profile.job_title} ${profile.education} ${profile.experience} ${profile.skills} ${profile.projects} ${profile.languages}`;
  const hasProfileData = Boolean(profileText.trim());
  const ranked = useMemo(() => offers.map(offer => ({ offer, score: offerScore(offer, profileText) })).sort((a, b) => b.score - a.score), [offers, profileText]);

  const generateLetter = async (offer: JobOffer) => {
    setLetterOffer(offer); setLetter(''); setLetterError(''); setLetterLoading(true);
    try {
      const prompt = `Rédige une lettre de motivation professionnelle et naturelle en français, prête à modifier. Candidat : ${profile.full_name || 'le candidat'}, profil : ${profileText}. Offre : ${offer.title}, entreprise : ${offer.entreprise?.nom || 'Entreprise'}, lieu : ${offer.location}, description : ${offer.description}, exigences : ${offer.requirements}. Ne mens pas sur l'expérience. Maximum 280 mots, sans Markdown.`;
      setLetter(await askGeminiCareerAssistant({ message: prompt, companies: [] }));
    } catch (error) { setLetterError(error instanceof Error ? error.message : 'La lettre n’a pas pu être générée.'); }
    finally { setLetterLoading(false); }
  };
  const requestAlert = async (offer: JobOffer) => {
    setAlertMessage('Vérification de votre correspondance…');
    const { data, error } = await supabase.functions.invoke('send-job-alert', { body: { offerId: offer.id } });
    if (error) setAlertMessage('Alerte indisponible : vérifiez la configuration e-mail.');
    else if (data?.sent) setAlertMessage(`Alerte envoyée par e-mail — correspondance ${data.score}%.`);
    else setAlertMessage(data?.reason === 'below-threshold' ? `Cette offre est sous votre seuil d’alerte (${data?.score ?? 0}%).` : 'Aucune alerte envoyée.');
  };

  return <div className="flex-1 overflow-auto bg-[#FBF9F7] p-8">
    {letterOffer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#1C1917]">Lettre de motivation IA</h2><p className="text-xs text-[#78716C]">Pour {letterOffer.title} · {letterOffer.entreprise?.nom || 'Entreprise'}</p></div><button onClick={() => setLetterOffer(null)} className="p-1 text-[#78716C]"><X size={18} /></button></div>{letterLoading ? <p className="py-12 text-center text-sm text-[#78716C]">Génération de votre lettre personnalisée…</p> : letterError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{letterError}</p> : <textarea value={letter} onChange={(event) => setLetter(event.target.value)} rows={15} className="w-full resize-none rounded-xl border border-[#EAE5E0] p-3 text-sm leading-relaxed text-[#1C1917] outline-none focus:border-[#621E3E]" />}{letter && <button onClick={() => void navigator.clipboard.writeText(letter)} className="mt-4 flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-bold text-white"><Copy size={14} /> Copier et modifier</button>}</div></div>}
    <div className="mb-7 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C6C954]/20"><BriefcaseBusiness size={20} className="text-[#667436]" /></div>
      <div><h1 className="text-xl font-bold text-[#1C1917]">Offres</h1><p className="text-sm text-[#78716C]">{offers.length} offre{offers.length > 1 ? 's' : ''} active{offers.length > 1 ? 's' : ''}, vérifiées et filtrées selon leur expiration.</p></div>
    </div>
    {!hasProfileData && <div className="mb-5 max-w-5xl rounded-xl border border-[#C6C954]/45 bg-[#C6C954]/10 px-4 py-3 text-sm text-[#4a4d1a]">Ajoutez des compétences dans le Studio CV ou analysez votre CV pour calculer les matchs avec les offres.</div>}
    {alertMessage && <div className="mb-5 max-w-5xl rounded-xl border border-[#667436]/30 bg-[#667436]/10 px-4 py-3 text-sm text-[#4a4d1a]">{alertMessage}</div>}
    {loading && <p className="text-sm text-[#78716C]">Chargement des offres validées…</p>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible de charger les offres : {error}</div>}
    {!loading && !error && ranked.length === 0 && <div className="max-w-2xl rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm"><h2 className="font-bold text-[#1C1917]">Aucune offre vérifiée pour le moment</h2><p className="mt-2 text-sm leading-relaxed text-[#78716C]">Les compétences s’affichent uniquement lorsqu’elles sont liées à une offre réelle et validée. Cela évite d’inventer des exigences pour une entreprise.</p></div>}
    <div className="grid max-w-5xl gap-4">{ranked.map(({ offer, score }) => <article key={offer.id} className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-[#1C1917]">{offer.title}</h2><span className="rounded-full bg-[#621E3E]/10 px-2.5 py-1 text-[11px] font-bold text-[#621E3E]">{labels[offer.contract_type]}</span></div><p className="text-sm font-semibold text-[#57534E]">{offer.entreprise?.nom || 'Entreprise non renseignée'}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#78716C]"><MapPin size={12} /> {offer.location}</p></div>
        <div className="rounded-xl bg-[#F5F1ED] px-4 py-2 text-center"><div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#78716C]"><Sparkles size={11} /> Match profil</div><p className="text-2xl font-extrabold" style={{ color: matchColor(score) }}>{hasProfileData ? `${score}%` : '—'}</p></div></div>
      <p className="mt-4 text-sm leading-relaxed text-[#57534E]">{offer.description}</p>
      {offer.requirements && <p className="mt-3 text-xs leading-relaxed text-[#78716C]"><b>Exigences :</b> {offer.requirements}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{offer.skills.length ? offer.skills.map(skill => <SkillTag key={skill} label={skill} />) : <span className="text-xs text-[#A8A29E]">Compétences non précisées par la source.</span>}</div>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#78716C]"><CalendarClock size={13} /> {expiryLabel(offer.expires_at)}</div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#F1ECE7] pt-4 text-xs font-semibold">
        {offer.entreprise_id && <button onClick={() => void toggleFavorite(offer.entreprise_id!)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${favorites.has(offer.entreprise_id) ? 'bg-[#D9828D]/15 text-[#A12E44]' : 'bg-[#621E3E] text-white hover:bg-[#4e1830]'}`}><Heart size={12} className={favorites.has(offer.entreprise_id) ? 'fill-current' : ''} /> {favorites.has(offer.entreprise_id) ? 'Dans mes favoris' : 'Ajouter aux favoris'}</button>}
        <button onClick={() => onNavigate('map')} className="flex items-center gap-1.5 rounded-lg border border-[#EAE5E0] px-3 py-2 text-[#621E3E] hover:bg-[#FBF9F7]"><Map size={12} /> Voir sur la carte</button>
        <button onClick={() => void generateLetter(offer)} className="flex items-center gap-1.5 rounded-lg border border-[#C6C954]/50 bg-[#C6C954]/10 px-3 py-2 text-[#4a4d1a] hover:bg-[#C6C954]/20"><FilePenLine size={12} /> Lettre IA</button>
        <button onClick={() => void requestAlert(offer)} className="flex items-center gap-1.5 rounded-lg border border-[#667436]/40 px-3 py-2 text-[#667436] hover:bg-[#667436]/10"><Bell size={12} /> M’alerter</button>
        {offer.entreprise?.email && <a className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#621E3E] hover:bg-[#FBF9F7] hover:underline" href={`mailto:${offer.entreprise.email}`}><Mail size={12} /> Contacter l’entreprise</a>}
        {offer.source_url && <a className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#621E3E] hover:bg-[#FBF9F7] hover:underline" href={offer.source_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Ouvrir l’annonce</a>}
      </div>
    </article>)}</div>
  </div>;
}
