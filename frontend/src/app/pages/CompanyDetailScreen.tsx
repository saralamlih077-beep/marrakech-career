import { useEffect, useState } from 'react';
import {
  Heart, MapPin, Globe, Mail, Send, X,
  Sparkles, CheckCircle, Eye, FilePenLine, Copy
} from 'lucide-react';
import { useCandidatures } from '../../hooks/useCandidatures';
import { useProfile } from '../../hooks/useProfile';
import { DOMAIN_COLORS } from '../constants';
import { matchColor, companyMatch, companyAddress } from '../utils';
import { SectorPill, SkillTag, PageHeader } from '../components/shared';
import type { Company, NavPage } from '../types';
import { supabase } from '../../lib/supabaseClient';
import { askGeminiCareerAssistant } from '../../lib/gemini';

export default function CompanyDetailScreen({ company, isFav, onFav, onBack, onNavigate }: {
  company: Company; isFav: boolean; onFav: (id: number) => void; onBack: () => void; onNavigate?: (page: NavPage) => void;
}) {
  const sc = DOMAIN_COLORS[company.domaine || ''] || '#621E3E';
  const initials = company.nom.split(' ').slice(0, 2).map(w => w[0]).join('');
  const match = companyMatch(company);

  const { data: candidatures, createCandidature } = useCandidatures();
  const { profile } = useProfile();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [targetPoste, setTargetPoste] = useState(profile.job_title || 'Stagiaire / D\u00e9veloppeur');
  const [targetStatut, setTargetStatut] = useState('applied');
  const [notes, setNotes] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [about, setAbout] = useState(company.about_summary || '');
  const [aboutSource, setAboutSource] = useState(company.about_source_url || '');
  const [aboutLoading, setAboutLoading] = useState(Boolean(company.site_web && !company.about_summary));
  const [showLetterModal, setShowLetterModal] = useState(false);
  const [letter, setLetter] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const [letterError, setLetterError] = useState('');

  const generateLetter = async () => {
    setLetterLoading(true);
    setLetterError('');
    try {
      const prompt = `Rédige une lettre de motivation professionnelle en français pour candidater chez ${company.nom}. Secteur : ${company.domaine || 'non renseigné'}${company.sous_domaine ? `, ${company.sous_domaine}` : ''}. Poste recherché : ${profile.job_title || 'non renseigné'}. Profil : études ${profile.education || 'non renseignées'} ; compétences ${profile.skills || 'non renseignées'} ; expérience ${profile.experience || 'non renseignée'}. Ne prétends pas que l’entreprise recrute. Utilise exactement cette structure : Objet, Bonjour, 2 courts paragraphes, formule de politesse et signature avec ${profile.full_name || 'le nom du candidat'}. Sans Markdown.`;
      const result = await askGeminiCareerAssistant({ message: prompt, companies: [] });
      setLetter(result.trim());
    } catch (err) {
      setLetterError(err instanceof Error ? `Impossible de générer la lettre : ${err.message}` : 'Impossible de générer la lettre.');
    } finally {
      setLetterLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setAbout(company.about_summary || '');
    setAboutSource(company.about_source_url || '');

    if (!company.site_web) {
      setAboutLoading(false);
      return () => { cancelled = true; };
    }

    setAboutLoading(true);
    supabase.functions.invoke('company-about', { body: { companyId: company.id } })
      .then(({ data, error }) => {
        if (cancelled || error || !data?.summary) return;
        setAbout(data.summary);
        setAboutSource(data.sourceUrl || '');
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setAboutLoading(false); });

    return () => { cancelled = true; };
  }, [company.id, company.site_web, company.about_summary, company.about_source_url]);

  const existingCandidature = candidatures.find(c => c.entreprise_id === company.id);

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7] relative">
      <PageHeader title="Company Details" back onBack={onBack} />

      {appliedSuccess && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm font-medium">Candidature enregistr\u00e9e avec succ\u00e8s dans votre suivi !</span>
          </div>
          {onNavigate && (
            <button onClick={() => onNavigate('applications')} className="text-xs font-bold underline hover:text-green-950">
              Voir mes candidatures &rarr;
            </button>
          )}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-6 mb-5">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0" style={{ backgroundColor: sc }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-[#1C1917] break-words">{company.nom}</h2>
              <SectorPill domaine={company.domaine || 'Domaine non renseign\u00e9'} sousDomaine={company.sous_domaine} />
            </div>
            <div className="flex items-center gap-5 text-sm text-[#78716C] flex-wrap">
              <span className="flex items-center gap-1 min-w-0 max-w-full"><MapPin size={13} className="shrink-0" /><span className="break-words">{companyAddress(company)}</span></span>
              <span className="flex items-center gap-1 min-w-0 max-w-full"><Globe size={13} className="shrink-0" /><span className="break-all">{company.site_web || 'Site non renseign\u00e9'}</span></span>
              <span className="flex items-center gap-1 min-w-0 max-w-full"><Mail size={13} className="shrink-0" /><span className="break-all">{company.email || 'Email non renseign\u00e9'}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onFav(company.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${isFav ? 'bg-[#D9828D]/10 text-[#D9828D] border-[#D9828D]/30' : 'bg-white text-[#78716C] border-[#EAE5E0] hover:border-[#D9828D]'}`}>
              <Heart size={14} className={isFav ? 'fill-[#D9828D]' : ''} /> {isFav ? 'Saved' : 'Save'}
            </button>
            {existingCandidature ? (
              <button onClick={() => onNavigate?.('applications')} className="flex items-center gap-2 px-4 py-2 bg-[#15803D]/10 text-[#15803D] border border-[#15803D]/30 rounded-xl text-sm font-semibold hover:bg-[#15803D]/20 transition-colors">
                <CheckCircle size={14} /> Applied ({existingCandidature.statut})
              </button>
            ) : (
              <button onClick={() => setShowApplyModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#621E3E] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1830] transition-colors shadow-sm">
                <Send size={14} /> Apply
              </button>
            )}
            <button onClick={() => { setShowLetterModal(true); if (!letter) void generateLetter(); }} className="flex items-center gap-2 px-4 py-2 bg-[#C6C954]/20 text-[#4a4d1a] border border-[#C6C954]/40 rounded-xl text-sm font-semibold hover:bg-[#C6C954]/30 transition-colors">
              <FilePenLine size={14} /> Lettre de motivation
            </button>
          </div>
        </div>
      </div>

      {showLetterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#EAE5E0] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#1C1917]">Lettre pour {company.nom}</h3>
                <p className="mt-1 text-xs text-[#78716C]">Générée à partir de votre profil. Relisez-la et adaptez-la avant envoi.</p>
              </div>
              <button onClick={() => setShowLetterModal(false)} className="rounded-lg p-1 text-[#78716C] hover:bg-[#F5F1ED]"><X size={18} /></button>
            </div>
            {letterLoading ? <p className="rounded-xl bg-[#C6C954]/10 p-5 text-sm text-[#57534E]">Création de votre lettre personnalisée…</p> : (
              <textarea value={letter} onChange={event => setLetter(event.target.value)} rows={15} className="w-full resize-none rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-4 text-sm leading-relaxed text-[#1C1917] outline-none focus:border-[#621E3E]" placeholder="Votre lettre apparaîtra ici." />
            )}
            {letterError && <p className="mt-3 text-xs text-red-700">{letterError}</p>}
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => void generateLetter()} disabled={letterLoading} className="rounded-xl border border-[#EAE5E0] px-4 py-2 text-xs font-bold text-[#621E3E] hover:bg-[#FBF9F7] disabled:opacity-50">Générer à nouveau</button>
              <button onClick={() => void navigator.clipboard.writeText(letter)} disabled={!letter || letterLoading} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-2 text-xs font-bold text-white hover:bg-[#4e1830] disabled:opacity-50"><Copy size={13} /> Copier la lettre</button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE5E0]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1C1917]">Postuler chez {company.nom}</h3>
                <p className="text-xs text-[#78716C] mt-0.5">Enregistrer votre candidature dans le tracker</p>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="p-1 rounded-lg text-[#78716C] hover:bg-[#F5F1ED]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">Poste cibl\u00e9</label>
                <input
                  type="text"
                  value={targetPoste}
                  onChange={e => setTargetPoste(e.target.value)}
                  placeholder="ex: D\u00e9veloppeur Frontend, Stagiaire..."
                  className="w-full px-3 py-2 text-sm border border-[#EAE5E0] rounded-xl focus:outline-none focus:border-[#621E3E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">Statut initial</label>
                <select
                  value={targetStatut}
                  onChange={e => setTargetStatut(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#EAE5E0] rounded-xl focus:outline-none focus:border-[#621E3E] bg-white"
                >
                  <option value="applied">Applied (Candidature envoy\u00e9e)</option>
                  <option value="prepared">Prepared (En pr\u00e9paration)</option>
                  <option value="saved">Saved (Sauvegard\u00e9)</option>
                  <option value="interview">Interview (Entretien)</option>
                </select>
              </div>

              {company.email && (
                <div>
                  <label className="block text-xs font-semibold text-[#57534E] mb-1">Email de contact</label>
                  <input
                    type="email"
                    defaultValue={company.email}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-[#EAE5E0] rounded-xl bg-[#F5F1ED] text-[#78716C]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1">Notes / remarques</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: Envoy\u00e9 avec CV moderne et lettre..."
                  className="w-full px-3 py-2 text-sm border border-[#EAE5E0] rounded-xl focus:outline-none focus:border-[#621E3E] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 px-4 py-2 border border-[#EAE5E0] rounded-xl text-sm font-semibold text-[#78716C] hover:bg-[#F5F1ED]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={applying}
                  onClick={async () => {
                    setApplying(true);
                    const res = await createCandidature({
                      entreprise_id: company.id,
                      poste: targetPoste,
                      statut: targetStatut,
                      notes,
                      contact_email: company.email || '',
                    });
                    setApplying(false);
                    if (res) {
                      setShowApplyModal(false);
                      setAppliedSuccess(true);
                      setTimeout(() => setAppliedSuccess(false), 5000);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-[#621E3E] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1830] transition-colors disabled:opacity-50"
                >
                  {applying ? 'Enregistrement...' : 'Confirmer la candidature'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1C1917] mb-3">About</h3>
            {aboutLoading && !about ? (
              <p className="text-sm text-[#78716C]">Recherche d’informations sur le site officiel…</p>
            ) : (
              <>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  {about || `${company.nom} est répertoriée dans le domaine ${company.domaine || 'non renseigné'}${company.sous_domaine ? ` (${company.sous_domaine})` : ''}.`}
                </p>
                {aboutSource && (
                  <a href={aboutSource} target="_blank" rel="noreferrer" className="inline-flex mt-3 text-xs font-semibold text-[#621E3E] hover:underline">
                    Source : site officiel
                  </a>
                )}
                {aboutLoading && <p className="text-xs text-[#A8A29E] mt-3">Mise à jour des informations publiques…</p>}
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1C1917] mb-3">Compétences demandées</h3>
            <p className="text-sm leading-relaxed text-[#78716C]">Les compétences réelles sont liées à chaque offre, pas au secteur général de l’entreprise.</p>
            <button onClick={() => onNavigate?.('opportunities')} className="mt-3 rounded-xl bg-[#621E3E] px-3 py-2 text-xs font-bold text-white hover:bg-[#4e1830]">Voir les offres vérifiées</button>
          </div>

          <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1C1917] mb-3">Opportunities</h3>
            <div className="flex flex-wrap gap-2">
              {(company.categorie || 'Cat\u00e9gorie non renseign\u00e9e').split(', ').map(t => (
                <span key={t} className="text-xs px-3 py-1 rounded-full bg-[#621E3E]/8 text-[#621E3E] font-semibold">{t}</span>
              ))}
            </div>
            <p className="text-xs text-[#78716C] mt-3">Priorit\u00e9: {company.priorite || 'Non renseign\u00e9e'}</p>
            <p className="text-xs text-[#78716C] mt-1">Note: {company.note ?? 'Non renseign\u00e9e'} ({company.nombre_avis ?? 0} avis)</p>
          </div>
        </div>

        {/* AI Match panel */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-[#C6C954]/40 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-[#667436]" />
              <h3 className="text-sm font-bold text-[#1C1917]">AI Profile Match</h3>
            </div>
            <div className="text-center mb-4">
              <div className="text-4xl font-extrabold mb-1" style={{ color: matchColor(match) }}>{match}%</div>
              <p className="text-xs text-[#78716C]">Profile compatibility</p>
            </div>
            <div className="w-full h-2 bg-[#F5F1ED] rounded-full mb-4 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${match}%`, backgroundColor: matchColor(match) }} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#57534E] mb-2">Matching skills</p>
              <span className="text-xs text-[#A8A29E]">Sélectionnez une offre vérifiée pour voir ses compétences.</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-[#57534E] mb-2">Skills to develop</p>
              <span className="text-xs text-[#A8A29E]">Disponible après comparaison avec une offre.</span>
            </div>
            <p className="text-xs text-[#78716C] mt-3 leading-relaxed">
              Ce score est indicatif pour le secteur. Les scores réellement liés aux compétences sont disponibles dans « Offres réelles ».
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1C1917] mb-3">Contact</h3>
            <div className="space-y-2 text-sm text-[#78716C]">
              <div className="flex items-center gap-2"><Mail size={13} />{company.email || 'Email non renseign\u00e9'}</div>
              <div className="flex items-center gap-2"><Globe size={13} />{company.site_web || 'Site non renseign\u00e9'}</div>
              <div className="flex items-center gap-2"><MapPin size={13} />{companyAddress(company)}</div>
              <div className="flex items-center gap-2"><span className="text-xs">Tel.</span>{company.telephone || 'T\u00e9l\u00e9phone non renseign\u00e9'}</div>
              {company.google_maps && <a href={company.google_maps} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#621E3E]">Voir sur Google Maps</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
