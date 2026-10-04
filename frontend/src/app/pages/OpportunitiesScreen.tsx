import { Bell, BriefcaseBusiness, CalendarClock, Copy, ExternalLink, FilePenLine, Heart, Mail, Map, MapPin, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useJobOffers, type JobOffer } from '../../hooks/useJobOffers';
import { useProfile } from '../../hooks/useProfile';
import { useOfferFavorites } from '../../hooks/useOfferFavorites';
import { SkillTag } from '../components/shared';
import type { NavPage } from '../types';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { supabase } from '../../lib/supabaseClient';
import { groupOffersBySource, offerContractLabel, offerEmployerName, offerSourceLabel, offerSourceKey } from '../offerSources';

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
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsLoadFailed, setAlertsLoadFailed] = useState(false);
  const [alertsUpdating, setAlertsUpdating] = useState(false);
  const [selectedSource, setSelectedSource] = useState('all');
  const profileText = `${profile.job_title} ${profile.education} ${profile.experience} ${profile.skills} ${profile.projects} ${profile.languages}`;
  const hasProfileData = Boolean(profileText.trim());
  const ranked = useMemo(() => offers
    .map(offer => ({ offer, score: offerScore(offer, profileText) }))
    .sort((a, b) => b.score - a.score), [offers, profileText]);
  const sourceGroups = useMemo(() => groupOffersBySource(ranked.map(({ offer }) => offer)), [ranked]);
  const visibleGroups = sourceGroups.filter(group => selectedSource === 'all' || group.key === selectedSource);
  const availableCount = sourceGroups.reduce((count, group) => count + group.offers.length, 0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) return;
        const { data, error: preferenceError } = await supabase
          .from('job_alert_preferences')
          .select('enabled')
          .eq('user_id', user.id)
          .maybeSingle();
        if (preferenceError) throw preferenceError;
        if (active) setAlertsEnabled(data?.enabled ?? false);
      } catch {
        if (active) {
          setAlertsLoadFailed(true);
          setAlertMessage('Impossible de charger vos alertes. Rechargez la page pour réessayer.');
        }
      } finally {
        if (active) setAlertsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!focusOfferId || loading) return;
    const timer = window.setTimeout(() => document.getElementById(`offer-${focusOfferId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => window.clearTimeout(timer);
  }, [focusOfferId, loading, offers, selectedSource]);

  useEffect(() => {
    const target = offers.find((offer) => offer.id === focusOfferId);
    const targetSource = target ? offerSourceKey(target) : null;
    if (targetSource) setSelectedSource(targetSource);
  }, [focusOfferId, offers]);

  const generateLetter = async (offer: JobOffer) => {
    setLetterOffer(offer); setLetter(''); setLetterError(''); setLetterLoading(true);
    try {
      const prompt = `Rédige une lettre de motivation professionnelle et naturelle en français, prête à modifier. Candidat : ${profile.full_name || 'le candidat'}, profil : ${profileText}. Offre : ${offer.title}, entreprise : ${offerEmployerName(offer)}, lieu : ${offer.location}, description : ${offer.description}, exigences : ${offer.requirements}. Ne mens pas sur l'expérience. Maximum 280 mots, sans Markdown.`;
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
      setAlertMessage(next ? 'Alertes activées : un récapitulatif quotidien des nouvelles offres sera envoyé à votre adresse d’inscription. Aucun e-mail sans nouvelle offre.' : 'Alertes désactivées.');
    }
    setAlertsUpdating(false);
  };

  return <div className="offers-screen flex-1 overflow-auto bg-[#FBF9F7] p-8">
    {letterOffer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#1C1917]">Lettre de motivation IA</h2><p className="text-xs text-[#78716C]">Pour {letterOffer.title} · {offerEmployerName(letterOffer)}</p></div><button onClick={() => setLetterOffer(null)} className="p-1 text-[#78716C]"><X size={18} /></button></div>{letterLoading ? <p className="py-12 text-center text-sm text-[#78716C]">Génération de votre lettre personnalisée…</p> : letterError ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{letterError}</p> : <textarea value={letter} onChange={(event) => setLetter(event.target.value)} rows={15} className="w-full resize-none rounded-xl border border-[#EAE5E0] p-3 text-sm leading-relaxed text-[#1C1917] outline-none focus:border-[#621E3E]" />}{letter && <button onClick={() => void navigator.clipboard.writeText(letter)} className="mt-4 flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-bold text-white"><Copy size={14} /> Copier et modifier</button>}</div></div>}
    <div className="mb-7 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C6C954]/20"><BriefcaseBusiness size={20} className="text-[#667436]" /></div>
      <div><h1 className="text-xl font-bold text-[#1C1917]">Offres</h1><p className="text-sm text-[#78716C]">{availableCount} offre{availableCount > 1 ? 's' : ''} disponible{availableCount > 1 ? 's' : ''}, classées par source.</p></div>
    </div>
    {!hasProfileData && <div className="mb-5 max-w-5xl rounded-xl border border-[#C6C954]/45 bg-[#C6C954]/10 px-4 py-3 text-sm text-[#4a4d1a]">Ajoutez des compétences dans le Studio CV ou analysez votre CV pour calculer les matchs avec les offres.</div>}
    <section className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#667436]/25 bg-white px-5 py-4 shadow-sm"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-[#667436]/10 p-2 text-[#667436]"><Bell size={17} /></div><div><h2 className="text-sm font-bold text-[#1C1917]">Alertes de nouvelles offres</h2><p className="mt-0.5 text-xs text-[#78716C]">Recevez chaque jour les nouvelles offres à votre adresse d’inscription. Aucun e-mail sans nouvelle offre.</p></div></div><button type="button" role="switch" aria-checked={alertsEnabled} disabled={alertsUpdating || alertsLoading || alertsLoadFailed} onClick={() => void updateAlerts()} className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${alertsEnabled ? 'bg-[#667436] text-white hover:bg-[#53602d]' : 'border border-[#D6CEC6] text-[#57534E] hover:bg-[#FBF9F7]'}`}>{alertsLoading ? 'Chargement…' : alertsUpdating ? 'Mise à jour…' : alertsEnabled ? 'Alertes activées' : 'Activer les alertes'}</button></section>
    {alertMessage && <div className="mb-5 max-w-5xl rounded-xl border border-[#667436]/30 bg-[#667436]/10 px-4 py-3 text-sm text-[#4a4d1a]">{alertMessage}</div>}
    {loading && <p className="text-sm text-[#78716C]">Chargement des offres validées…</p>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible de charger les offres : {error}</div>}
    {!loading && !error && availableCount === 0 && <div className="max-w-2xl rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm"><h2 className="font-bold text-[#1C1917]">Aucune offre disponible pour le moment</h2><p className="mt-2 text-sm leading-relaxed text-[#78716C]">Les annonces seront affichées ici avec leur source et leur lien d’origine.</p></div>}
    {!loading && !error && availableCount > 0 && <><nav aria-label="Filtrer les offres par source" className="mb-5 flex max-w-5xl flex-wrap gap-2 rounded-2xl border border-[#EAE5E0] bg-white p-2 shadow-sm">{[{ key: 'all', label: 'Toutes les sources', count: availableCount }, ...sourceGroups.map(group => ({ key: group.key, label: group.label, count: group.offers.length }))].map(source => <button key={source.key} type="button" aria-pressed={selectedSource === source.key} onClick={() => setSelectedSource(source.key)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${selectedSource === source.key ? 'bg-[#621E3E] text-white shadow-sm' : 'text-[#57534E] hover:bg-[#FBF9F7]'}`}>{source.label} <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] ${selectedSource === source.key ? 'bg-white/20 text-white' : 'bg-[#F1ECE7] text-[#78716C]'}`}>{source.count}</span></button>)}</nav>
    {visibleGroups.length === 0 && <div className="max-w-5xl rounded-2xl border border-dashed border-[#D6CEC6] bg-white p-6 text-sm text-[#78716C]">Aucune offre disponible pour cette source pour le moment.</div>}
    {visibleGroups.map(group => <section key={group.key} aria-label={`Offres ${group.label}`} className="mb-8 max-w-5xl"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-base font-extrabold text-[#1C1917]">Offres {group.label}</h2><p className="mt-0.5 text-xs text-[#78716C]">Voici les offres provenant de {group.label}.</p></div><span className="shrink-0 text-xs font-semibold text-[#78716C]">{group.offers.length} offre{group.offers.length > 1 ? 's' : ''}</span></div>
    <div className="grid gap-4">{group.offers.map(offer => <article id={`offer-${offer.id}`} key={offer.id} className={`offer-card min-w-0 rounded-2xl border bg-white p-5 shadow-sm ${focusOfferId === offer.id ? 'border-[#C6C954] ring-2 ring-[#C6C954]/35' : 'border-[#EAE5E0]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="offer-title text-base font-bold text-[#1C1917]">{offer.title}</h3><span className="offer-type rounded-full bg-[#621E3E]/10 px-2.5 py-1 text-[11px] font-bold text-[#621E3E]">{offerContractLabel(offer)}</span></div><p className="text-sm font-semibold text-[#57534E]">{offerEmployerName(offer)}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#78716C]"><MapPin size={12} /> {offer.location}</p></div><span className="rounded-full bg-[#667436]/10 px-3 py-1 text-xs font-bold text-[#53602d]">Source : {offerSourceLabel(offer)}</span>
      </div>
      {offer.source_origin && <p className="mt-2 text-xs text-[#78716C]">Source d’origine : {offer.source_origin}</p>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#78716C]">{[offer.offer_domain, offer.work_mode, offer.duration, offer.compensation, offer.education_level].filter(Boolean).map((detail, index) => <span key={index}>{detail}</span>)}</div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#57534E]">{offer.description}</p>
      {offer.requirements && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#78716C]"><b>Exigences :</b> {offer.requirements}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{offer.skills.length ? offer.skills.map(skill => <SkillTag key={skill} label={skill} />) : <span className="text-xs text-[#A8A29E]">Compétences non précisées par la source.</span>}</div>
      <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#78716C]"><CalendarClock size={13} /> {expiryLabel(offer.expires_at)}</div>
      <div className="offer-actions mt-5 flex flex-wrap gap-2 border-t border-[#F1ECE7] pt-4 text-xs font-semibold">
        <button onClick={() => void toggleOfferFavorite(offer.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${favoriteOffers.has(offer.id) ? 'bg-[#D9828D]/15 text-[#A12E44]' : 'bg-[#621E3E] text-white hover:bg-[#4e1830]'}`}><Heart size={12} className={favoriteOffers.has(offer.id) ? 'fill-current' : ''} /> {favoriteOffers.has(offer.id) ? 'Offre favorite' : 'Ajouter aux favoris'}</button>
        <button onClick={() => onViewOnMap(offer)} className="flex items-center gap-1.5 rounded-lg border border-[#EAE5E0] px-3 py-2 text-[#621E3E] hover:bg-[#FBF9F7]"><Map size={12} /> Voir sur la carte</button>
        <button onClick={() => onApply(offer)} className="flex items-center gap-1.5 rounded-lg bg-[#621E3E] px-3 py-2 text-white hover:bg-[#4e1830]"><Send size={12} /> Apply</button>
        <button onClick={() => void generateLetter(offer)} className="flex items-center gap-1.5 rounded-lg border border-[#C6C954]/50 bg-[#C6C954]/10 px-3 py-2 text-[#4a4d1a] hover:bg-[#C6C954]/20"><FilePenLine size={12} /> Lettre IA</button>
        {(offer.contact_email || offer.entreprise?.email) && <a className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#621E3E] hover:bg-[#FBF9F7] hover:underline" href={`mailto:${offer.contact_email || offer.entreprise?.email}`}><Mail size={12} /> Contacter l’entreprise</a>}
        {offer.source_url && <a className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#621E3E] hover:bg-[#FBF9F7] hover:underline" href={offer.source_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Ouvrir l’annonce</a>}
      </div>
      </article>)}</div></section>)}
    </>}
  </div>;
}
