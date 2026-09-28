import { Bell, BriefcaseBusiness, CalendarClock, Copy, ExternalLink, FilePenLine, Heart, Mail, Map, MapPin, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useJobOffers, type JobOffer } from '../../hooks/useJobOffers';
import { useProfile } from '../../hooks/useProfile';
import { useOfferFavorites } from '../../hooks/useOfferFavorites';
import { SkillTag } from '../components/shared';
import type { NavPage } from '../types';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { supabase } from '../../lib/supabaseClient';

const labels: Record<JobOffer['contract_type'], string> = {
  internship: 'Stage', cdi: 'CDI', cdd: 'CDD', freelance: 'Freelance',
};

const sourceDetails = {
  jobsquare: { title: 'Offres Jobsquare', description: 'Offres provenant de Jobsquare', order: 0 },
  job_opportunities_api: { title: 'Offres Job Opportunities API', description: 'Offres réelles marocaines liées à Marrakech', order: 1 },
} as const;

type OfferSource = keyof typeof sourceDetails;

function sourceKey(offer: JobOffer): OfferSource | null {
  if (offer.source_name === 'jobsquare') return 'jobsquare';
  if (offer.source_name === 'job_opportunities_api') return 'job_opportunities_api';
  return null;
}

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

export default function OpportunitiesScreen({ onNavigate, focusOfferId, onViewOnMap, onApply }: { onNavigate: (page: NavPage) => void; focusOfferId?: string | null; onViewOnMap: (offer: JobOffer) => void; onApply: (offer: JobOffer) => void }) {
  const { offers, loading, error } = useJobOffers();
  const { profile } = useProfile();
  const { favoriteOffers, toggleOfferFavorite } = useOfferFavorites();
  const [letterOffer, setLetterOffer] = useState<JobOffer | null>(null);
  const [letter, setLetter] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertsUpdating, setAlertsUpdating] = useState(false);
  const [selectedSource, setSelectedSource] = useState<OfferSource>('jobsquare');
  const profileText = `${profile.job_title} ${profile.education} ${profile.experience} ${profile.skills} ${profile.projects} ${profile.languages}`;
  const hasProfileData = Boolean(profileText.trim());
  const ranked = useMemo(() => offers
    .map(offer => ({ offer, score: offerScore(offer, profileText) }))
    .filter(({ offer }) => sourceKey(offer) !== null)
    .sort((a, b) => {
      const sourceDifference = sourceDetails[sourceKey(a.offer)!].order - sourceDetails[sourceKey(b.offer)!].order;
      return sourceDifference || b.score - a.score;
    }), [offers, profileText]);
  const sourceCounts = useMemo(() => ({
    jobsquare: ranked.filter(({ offer }) => sourceKey(offer) === 'jobsquare').length,
    job_opportunities_api: ranked.filter(({ offer }) => sourceKey(offer) === 'job_opportunities_api').length,
  }), [ranked]);
  const sourceOffers = ranked.filter(({ offer }) => sourceKey(offer) === selectedSource);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('job_alert_preferences')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) setAlertsEnabled(data?.enabled ?? true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!focusOfferId || loading) return;
    const timer = window.setTimeout(() => document.getElementById(`offer-${focusOfferId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => window.clearTimeout(timer);
  }, [focusOfferId, loading, offers]);

  useEffect(() => {
    const target = offers.find((offer) => offer.id === focusOfferId);
    const targetSource = target ? sourceKey(target) : null;
    if (targetSource) setSelectedSource(targetSource);
  }, [focusOfferId, offers]);

  const generateLetter = async (offer: JobOffer) => {
    setLetterOffer(offer); setLetter(''); setLetterError(''); setLetterLoading(true);
    try {
      const prompt = `Rédige une lettre de motivation professionnelle et naturelle en français, prête à modifier. Candidat : ${profile.full_name || 'le candidat'}, profil : ${profileText}. Offre : ${offer.title}, entreprise : ${offer.entreprise?.nom || 'Entreprise'}, lieu : ${offer.location}, description : ${offer.description}, exigences : ${offer.requirements}. Ne mens pas sur l'expérience. Maximum 280 mots, sans Markdown.`;
      setLetter(await askGeminiCareerAssistant({ message: prompt, companies: [] }));
    } catch (error) { setLetterError(error instanceof Error ? error.message : 'La lettre n’a pas pu être générée.'); }
    finally { setLetterLoading(false); }
  };
  const updateAlerts = async () => {
    const next = !alertsEnabled;
    setAlertsUpdating(true);
    setAlertMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAlertMessage('Connectez-vous pour gérer vos alertes.');
      setAlertsUpdating(false);
      return;
    }
    const { error } = await supabase.from('job_alert_preferences').upsert({
      user_id: user.id,
      enabled: next,
      updated_at: new Date().toISOString(),
    });
    if (error) setAlertMessage('Impossible de modifier les alertes.');
    else {
      setAlertsEnabled(next);
      setAlertMessage(next ? 'Alertes activées : vous recevrez toutes les nouvelles offres par e-mail.' : 'Alertes désactivées.');
    }
    setAlertsUpdating(false);
  };

  return <div className="offers-screen flex-1 overflow-auto bg-[#FBF9F7] p-8">
    {letterOffer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#1C1917]">Lettre de motivation IA</h2><p className="text-xs text-[#78716C]">Pour {letterOffer.title} · {letterOffer.entreprise?.nom || 'Entreprise'}</p></div><button onClick={() => setLetterOffer(null)} className="p-1 text-[#78716C]"><X size={18} /></button></div>{letterLoading ? <p className="py-12 text-center text-sm text-[#78716C]">Génération de votre lettre personnalisée…</p> : letterError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{letterError}</p> : <textarea value={letter} onChange={(event) => setLetter(event.target.value)} rows={15} className="w-full resize-none rounded-xl border border-[#EAE5E0] p-3 text-sm leading-relaxed text-[#1C1917] outline-none focus:border-[#621E3E]" />}{letter && <button onClick={() => void navigator.clipboard.writeText(letter)} className="mt-4 flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-bold text-white"><Copy size={14} /> Copier et modifier</button>}</div></div>}
    <div className="mb-7 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C6C954]/20"><BriefcaseBusiness size={20} className="text-[#667436]" /></div>
      <div><h1 className="text-xl font-bold text-[#1C1917]">Offres</h1><p className="text-sm text-[#78716C]">{offers.length} offre{offers.length > 1 ? 's' : ''} active{offers.length > 1 ? 's' : ''}, vérifiées et filtrées selon leur expiration.</p></div>
    </div>
    {!hasProfileData && <div className="mb-5 max-w-5xl rounded-xl border border-[#C6C954]/45 bg-[#C6C954]/10 px-4 py-3 text-sm text-[#4a4d1a]">Ajoutez des compétences dans le Studio CV ou analysez votre CV pour calculer les matchs avec les offres.</div>}
    <section className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#667436]/25 bg-white px-5 py-4 shadow-sm"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-[#667436]/10 p-2 text-[#667436]"><Bell size={17} /></div><div><h2 className="text-sm font-bold text-[#1C1917]">Alertes de nouvelles offres</h2><p className="mt-0.5 text-xs text-[#78716C]">Recevez un e-mail récapitulatif de toutes les nouvelles offres disponibles.</p></div></div><button type="button" role="switch" aria-checked={alertsEnabled} disabled={alertsUpdating} onClick={() => void updateAlerts()} className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${alertsEnabled ? 'bg-[#667436] text-white hover:bg-[#53602d]' : 'border border-[#D6CEC6] text-[#57534E] hover:bg-[#FBF9F7]'}`}>{alertsUpdating ? 'Mise à jour…' : alertsEnabled ? 'Alertes activées' : 'Activer les alertes'}</button></section>
    {alertMessage && <div className="mb-5 max-w-5xl rounded-xl border border-[#667436]/30 bg-[#667436]/10 px-4 py-3 text-sm text-[#4a4d1a]">{alertMessage}</div>}
    {loading && <p className="text-sm text-[#78716C]">Chargement des offres validées…</p>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible de charger les offres : {error}</div>}
    {!loading && !error && ranked.length === 0 && <div className="max-w-2xl rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm"><h2 className="font-bold text-[#1C1917]">Aucune offre vérifiée pour le moment</h2><p className="mt-2 text-sm leading-relaxed text-[#78716C]">Les compétences s’affichent uniquement lorsqu’elles sont liées à une offre réelle et validée. Cela évite d’inventer des exigences pour une entreprise.</p></div>}
    {!loading && !error && ranked.length > 0 && <><div className="mb-5 flex max-w-5xl flex-wrap gap-2 rounded-2xl border border-[#EAE5E0] bg-white p-2 shadow-sm">{(Object.keys(sourceDetails) as OfferSource[]).map(source => <button key={source} type="button" onClick={() => setSelectedSource(source)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${selectedSource === source ? 'bg-[#621E3E] text-white shadow-sm' : 'text-[#57534E] hover:bg-[#FBF9F7]'}`}>{sourceDetails[source].title} <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] ${selectedSource === source ? 'bg-white/20 text-white' : 'bg-[#F1ECE7] text-[#78716C]'}`}>{sourceCounts[source]}</span></button>)}</div>
    <div className="mb-3 flex max-w-5xl items-end justify-between gap-3"><div><h2 className="text-sm font-extrabold text-[#1C1917]">{sourceDetails[selectedSource].title}</h2><p className="mt-0.5 text-xs text-[#78716C]">{sourceDetails[selectedSource].description}</p></div><span className="text-xs font-semibold text-[#78716C]">{sourceOffers.length} offre{sourceOffers.length > 1 ? 's' : ''}</span></div>
    {sourceOffers.length === 0 ? <div className="max-w-5xl rounded-2xl border border-dashed border-[#D6CEC6] bg-white p-6 text-sm text-[#78716C]">Aucune offre disponible pour cette source pour le moment.</div> : <div className="grid max-w-5xl gap-4">{sourceOffers.map(({ offer }) => <article id={`offer-${offer.id}`} key={offer.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${focusOfferId === offer.id ? 'border-[#C6C954] ring-2 ring-[#C6C954]/35' : 'border-[#EAE5E0]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-1 flex flex-wrap items-center gap-2"><h2 className="offer-title text-base font-bold text-[#1C1917]">{offer.title}</h2><span className="offer-type rounded-full bg-[#621E3E]/10 px-2.5 py-1 text-[11px] font-bold text-[#621E3E]">{labels[offer.contract_type]}</span></div><p className="text-sm font-semibold text-[#57534E]">{offer.entreprise?.nom || 'Entreprise non renseignée'}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#78716C]"><MapPin size={12} /> {offer.location}</p></div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#57534E]">{offer.description}</p>
      {offer.requirements && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#78716C]"><b>Exigences :</b> {offer.requirements}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{offer.skills.length ? offer.skills.map(skill => <SkillTag key={skill} label={skill} />) : <span className="text-xs text-[#A8A29E]">Compétences non précisées par la source.</span>}</div>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#78716C]"><CalendarClock size={13} /> {expiryLabel(offer.expires_at)}</div>
      <div className="offer-actions mt-5 flex flex-wrap gap-2 border-t border-[#F1ECE7] pt-4 text-xs font-semibold">
        <button onClick={() => void toggleOfferFavorite(offer.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${favoriteOffers.has(offer.id) ? 'bg-[#D9828D]/15 text-[#A12E44]' : 'bg-[#621E3E] text-white hover:bg-[#4e1830]'}`}><Heart size={12} className={favoriteOffers.has(offer.id) ? 'fill-current' : ''} /> {favoriteOffers.has(offer.id) ? 'Offre favorite' : 'Ajouter aux favoris'}</button>
        <button onClick={() => onViewOnMap(offer)} className="flex items-center gap-1.5 rounded-lg border border-[#EAE5E0] px-3 py-2 text-[#621E3E] hover:bg-[#FBF9F7]"><Map size={12} /> Voir sur la carte</button>
        <button onClick={() => onApply(offer)} className="flex items-center gap-1.5 rounded-lg bg-[#621E3E] px-3 py-2 text-white hover:bg-[#4e1830]"><Send size={12} /> Apply</button>
        <button onClick={() => void generateLetter(offer)} className="flex items-center gap-1.5 rounded-lg border border-[#C6C954]/50 bg-[#C6C954]/10 px-3 py-2 text-[#4a4d1a] hover:bg-[#C6C954]/20"><FilePenLine size={12} /> Lettre IA</button>
        {offer.entreprise?.email && <a className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#621E3E] hover:bg-[#FBF9F7] hover:underline" href={`mailto:${offer.entreprise.email}`}><Mail size={12} /> Contacter l’entreprise</a>}
        {offer.source_url && <a className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#621E3E] hover:bg-[#FBF9F7] hover:underline" href={offer.source_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Ouvrir l’annonce</a>}
      </div>
      </article>)}</div>}
    </>}
  </div>;
}
