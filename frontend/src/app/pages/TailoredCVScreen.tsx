import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Download, LoaderCircle, Pencil, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../hooks/useProfile';
import { tailoredCvPdf } from '../../lib/tailoredCvPdf';
import { cvGenerationRequest, cvLayouts, cvPalettes, parseGeneratedCv, profileToCvInput, type CvInput, type CvSection, type GeneratedCv } from '../tailoredCv';
import { prepareCvPhoto } from '../../lib/cvPhoto';
import { PageHeader } from '../components/shared';
import type { Company } from '../types';

function CvSectionView({ section, inverse = false, gold = false, timeline = false }: { section: CvSection; inverse?: boolean; gold?: boolean; timeline?: boolean }) {
  const compact = ['skills', 'languages'].includes(section.kind);
  return <section className="mb-7 last:mb-0">
    <h3 className={`mb-3 flex items-center gap-2 border-b pb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${inverse ? 'border-white/25 text-white' : 'border-slate-200 text-[var(--cv-accent)]'}`}>{gold && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E9B422]" />}{section.title}</h3>
    <div className={compact ? inverse ? 'space-y-2.5' : 'grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3' : 'space-y-4'}>{section.items.map((item, i) => <div key={i} className={timeline && !compact ? 'relative border-l border-[#E9B422]/60 pl-4 before:absolute before:-left-[3px] before:top-2 before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#E9B422]' : ''}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h4 className={`text-[12px] font-semibold leading-relaxed ${inverse ? 'text-white' : 'text-slate-800'}`}>{item.heading}</h4>{item.period && <span className={`text-[10px] ${inverse ? 'text-white/70' : 'text-slate-500'}`}>{item.period}</span>}</div>
      {item.subheading && <p className={`mt-0.5 text-[11px] leading-relaxed ${inverse ? 'text-white/75' : 'text-slate-500'}`}>{item.subheading}</p>}
      {!!item.bullets.length && <ul className={`mt-2 list-disc space-y-1 pl-4 text-[11px] leading-[1.7] ${inverse ? 'text-white/85' : 'text-slate-600'}`}>{item.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>}
    </div>)}</div>
  </section>;
}

function CvDocument({ cv }: { cv: GeneratedCv }) {
  const sunshine = cv.layout === 'sunshine';
  const golden = cv.layout === 'golden-columns';
  const sidebar = cv.layout === 'sidebar' || sunshine;
  const compact = cv.sections.filter(section => ['skills', 'languages'].includes(section.kind));
  const main = sidebar ? cv.sections.filter(section => !['skills', 'languages'].includes(section.kind)) : cv.sections;
  const contacts = [cv.identity.email, cv.identity.phone, cv.identity.city, cv.identity.linkedin].filter(Boolean);
  const style = { '--cv-accent': sunshine || golden ? '#252C32' : cvPalettes[cv.palette] } as React.CSSProperties;
  const portrait = (round: boolean, className: string) => cv.identity.photoDataUrl ? <img src={cv.identity.photoDataUrl} alt="Photo du candidat" className={`shrink-0 object-cover ${round ? 'rounded-full' : 'rounded-sm'} ${className}`} /> : null;
  const contactBlock = (inverse: boolean) => !!contacts.length && <section className="mb-8"><h3 className={`mb-3 flex items-center gap-2 border-b pb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${inverse ? 'border-white/25 text-white' : 'border-slate-200 text-slate-800'}`}>{(golden || sunshine) && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#E9B422]" />}Contact</h3><div className={`space-y-2 text-[11px] leading-relaxed ${inverse ? 'text-white/85' : 'text-slate-600'}`}>{contacts.map((contact, index) => <p key={index} className="break-words">{contact}</p>)}</div></section>;
  const profileBlock = <section className="mb-7"><h3 className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--cv-accent)]">{(golden || sunshine) && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E9B422]" />}Profil</h3><p className="text-[12px] leading-[1.8] text-slate-600">{cv.summary}</p></section>;
  if (golden) return <article aria-label="CV généré par l’IA" data-layout={cv.layout} style={style} className="mx-auto min-h-[850px] max-w-[794px] bg-white p-5 shadow-[0_8px_45px_rgba(0,0,0,0.08)] sm:p-8">
    <header className="mb-7 grid items-center gap-5 bg-[#F0F0EE] p-5 sm:grid-cols-[1fr_190px]"><div className="flex items-center gap-4">{portrait(false, 'h-20 w-20')}<div className="min-w-0"><h2 className="break-words text-2xl font-bold uppercase leading-tight text-slate-900">{cv.identity.fullName}</h2><p className="mt-2 text-[12px] text-slate-600">{cv.identity.targetRole}</p></div></div><div className="space-y-1.5 text-[10px] text-slate-600">{contacts.map((contact, index) => <p key={index} className="flex gap-2 break-all"><span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 bg-[#E9B422]" />{contact}</p>)}</div></header>
    <div className="grid gap-7 sm:grid-cols-[1.2fr_1fr]"><div className="sm:border-r sm:border-[#E9B422]/50 sm:pr-7">{profileBlock}{cv.sections.filter(section => ['experience', 'education'].includes(section.kind)).map(section => <CvSectionView key={section.kind} section={section} gold />)}</div><div>{cv.sections.filter(section => !['experience', 'education'].includes(section.kind)).map(section => <CvSectionView key={section.kind} section={section} gold />)}</div></div>
  </article>;
  return <article aria-label="CV généré par l’IA" data-layout={cv.layout} style={style} className={`mx-auto min-h-[850px] max-w-[794px] overflow-hidden bg-white shadow-[0_8px_45px_rgba(0,0,0,0.08)] ${sidebar ? 'grid sm:grid-cols-[235px_1fr]' : 'px-7 py-10 sm:px-12'}`}>
    {sidebar && <aside className="relative overflow-hidden bg-[var(--cv-accent)] px-7 py-10 text-white">
      {sunshine && <div aria-hidden="true" className="absolute left-0 top-0 h-40 w-full bg-[#E9B422] [clip-path:polygon(0_0,100%_0,100%_48%,0_100%)]" />}
      <div className={`relative mb-9 ${sunshine ? 'text-center' : ''}`}>
        {portrait(true, sunshine ? 'mx-auto h-28 w-28 border-4 border-white' : 'h-20 w-20 border-2 border-white/30') || <div className={`flex h-20 w-20 items-center justify-center rounded-full border border-white/30 text-xl font-light tracking-widest ${sunshine ? 'mx-auto bg-[#252C32]' : ''}`}>{cv.identity.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</div>}
        {sunshine && <><h2 className="mt-5 break-words text-xl font-semibold leading-tight text-[#F4C748]">{cv.identity.fullName}</h2><p className="mt-2 text-[11px] text-white/80">{cv.identity.targetRole}</p></>}
      </div>
      {contactBlock(true)}
      {compact.map(section => <CvSectionView key={section.kind} section={section} inverse gold={sunshine} />)}
    </aside>}
    <div className={sidebar ? 'px-7 py-10 sm:px-9' : ''}>
      {!sunshine && <header className={`mb-7 ${cv.layout === 'editorial' ? 'border-b-2 border-[var(--cv-accent)] pb-6' : ''}`}>
        {!sidebar && portrait(cv.layout === 'editorial', 'float-right ml-4 mb-2 h-20 w-20')}
        <h2 className={`break-words font-semibold leading-tight tracking-tight text-[var(--cv-accent)] ${cv.layout === 'editorial' ? 'font-serif text-4xl' : 'text-3xl'}`}>{cv.identity.fullName}</h2>
        <p className="mt-2 text-sm font-medium tracking-wide text-slate-500">{cv.identity.targetRole}</p>
        {!sidebar && !!contacts.length && <p className="mt-4 break-words text-[11px] leading-relaxed text-slate-500">{contacts.join('  ·  ')}</p>}
      </header>}
      {profileBlock}
      {main.map(section => <CvSectionView key={section.kind} section={section} gold={sunshine} timeline={sunshine} />)}
    </div>
  </article>;
}

export default function TailoredCVScreen({ initialCompany, onChooseCompany, onBack }: { initialCompany: Company | null; onChooseCompany: () => void; onBack: () => void }) {
  const { profile, email, loading } = useProfile();
  const [company, setCompany] = useState<Company | null>(initialCompany);
  const [input, setInput] = useState<CvInput>(() => profileToCvInput(profile, email));
  const initialized = useRef(false);
  const mounted = useRef(true);
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [cv, setCv] = useState<GeneratedCv | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!loading && !initialized.current) { initialized.current = true; setInput(profileToCvInput(profile, email)); } }, [loading, profile, email]);
  const addPhoto = async (file?: File) => {
    if (!file) return;
    setPreparingPhoto(true); setError('');
    try {
      const photoDataUrl = await prepareCvPhoto(file);
      if (mounted.current) setInput(current => ({ ...current, photoDataUrl }));
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Impossible de lire la photo.'); }
    finally { if (mounted.current) setPreparingPhoto(false); }
  };
  const generate = async () => {
    if (!consent || generating || loading || preparingPhoto) return;
    if (!input.fullName.trim() || !input.targetRole.trim() || input.background.trim().length < 20) return setError('Indiquez votre nom, le poste recherché et quelques informations sur votre parcours.');
    setError(''); setGenerating(true);
    const snapshot = { ...input };
    try {
      const { data, error: serviceError } = await supabase.functions.invoke<{ cv?: unknown; error?: string }>('generate-company-cv', { body: cvGenerationRequest(company, snapshot, cv?.layout) });
      if (serviceError) {
        const context = (serviceError as { context?: Response }).context;
        let message = 'La génération IA est indisponible. Réessayez dans quelques instants.';
        if (context instanceof Response) { try { const response = await context.json(); if (typeof response.error === 'string') message = response.error; } catch { /* Keep the public fallback. */ } }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      const result = parseGeneratedCv(data?.cv, snapshot);
      if (mounted.current) setCv(result);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Impossible de générer le CV.'); }
    finally { if (mounted.current) setGenerating(false); }
  };
  const download = () => {
    if (!cv) return;
    try {
      const filename = `${cv.identity.fullName}-CV${company ? `-${company.nom}` : ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 120);
      tailoredCvPdf(cv).save(`${filename}.pdf`);
    } catch { setError('Impossible de créer le PDF. Réessayez.'); }
  };
  const fieldClass = 'mt-2 w-full rounded-xl border border-[#EAE5E0] bg-white px-4 py-3 text-sm text-[#1C1917] outline-none focus:border-[#621E3E] disabled:opacity-60';
  const fields: Array<{ key: Exclude<keyof CvInput, 'background' | 'photoDataUrl'>; label: string; required?: boolean }> = [{ key: 'fullName', label: 'Nom complet', required: true }, { key: 'targetRole', label: 'Poste recherché', required: true }, { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Téléphone' }, { key: 'city', label: 'Ville' }, { key: 'linkedin', label: 'LinkedIn' }];
  return <div className="min-w-0 flex-1 overflow-auto bg-[#FBF9F7] p-4 sm:p-6 lg:p-8">
    <PageHeader title="Générer un CV avec l’IA" sub={company ? `Pour ${company.nom}` : 'À partir de vos informations et du poste recherché'} back onBack={onBack} />
    <div className="mx-auto mb-6 flex max-w-3xl items-center gap-3 text-xs"><span className="flex items-center gap-2 font-semibold text-[#621E3E]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#621E3E] text-white">{cv ? <Check size={14} /> : '1'}</span>Vos informations</span><span className="h-px flex-1 bg-[#EAE5E0]" /><span className={`flex items-center gap-2 font-semibold ${cv ? 'text-[#621E3E]' : 'text-[#A8A29E]'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full ${cv ? 'bg-[#621E3E] text-white' : 'bg-[#EAE5E0]'}`}>2</span>Votre CV généré</span></div>
    {loading ? <p className="py-8 text-sm text-[#78716C]">Chargement de vos informations…</p> : !cv ? <section className="mx-auto max-w-3xl rounded-2xl border border-[#EAE5E0] bg-white p-5 sm:p-8">
      <div className="mb-7 flex items-start gap-4"><div className="rounded-xl bg-[#621E3E]/10 p-3 text-[#621E3E]"><Sparkles size={24} /></div><div><h2 className="text-lg font-bold text-[#1C1917]">Racontez votre parcours. L’IA crée votre CV.</h2><p className="mt-2 text-sm leading-relaxed text-[#78716C]">L’IA rédige le contenu, organise les rubriques et choisit une présentation professionnelle {company ? `pour ${company.nom}` : 'adaptée au poste recherché'}.</p></div></div>
      <form onSubmit={event => { event.preventDefault(); void generate(); }}>
        <div className="mb-6 border-b border-[#EAE5E0] pb-5">
          <p className="text-xs leading-relaxed text-[#78716C]">{company ? `Entreprise choisie : ${company.nom}.` : 'Vous souhaitez un CV adapté à une entreprise ? Rendez-vous sur la page Entreprises et cliquez sur « CV IA » sur sa fiche. Sinon, continuez ici pour un CV général.'}</p>
          <div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={generating || preparingPhoto} onClick={onChooseCompany} className="flex items-center gap-2 text-sm font-semibold text-[#621E3E] disabled:opacity-60">{company ? 'Changer d’entreprise' : 'Choisir une entreprise'}<ArrowRight size={16} /></button>{company && <button type="button" disabled={generating} onClick={() => setCompany(null)} className="flex items-center gap-1 text-xs font-semibold text-[#78716C] disabled:opacity-60"><X size={14} />Continuer sans entreprise</button>}</div>
        </div>
        <section aria-label="Photo du CV" className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-[#FBF9F7] p-4">
          {input.photoDataUrl ? <img src={input.photoDataUrl} alt="Aperçu de votre photo" className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[#D6D3D1] text-[#A8A29E]"><Camera size={25} /></div>}
          <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[#57534E]">Photo (facultative)</h3><p className="mt-1 text-xs text-[#78716C]">JPG, PNG ou WebP · 5 Mo maximum. Recadrage carré centré.</p><label className="mt-3 block text-xs font-semibold text-[#621E3E]">{preparingPhoto ? 'Préparation de la photo…' : 'Ajouter ou remplacer ma photo'}<input aria-label="Ajouter une photo au CV" type="file" accept="image/jpeg,image/png,image/webp" disabled={generating || preparingPhoto} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void addPhoto(file); }} className="mt-2 block w-full text-xs font-normal text-[#78716C] file:mr-3 file:rounded-lg file:border-0 file:bg-[#621E3E]/10 file:px-3 file:py-2 file:font-semibold file:text-[#621E3E]" /></label></div>
          {input.photoDataUrl && <button type="button" disabled={generating || preparingPhoto} onClick={() => setInput(current => ({ ...current, photoDataUrl: undefined }))} className="flex items-center gap-1 text-xs text-[#78716C]"><X size={14} />Retirer la photo</button>}
        </section>
        <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="text-xs font-semibold text-[#57534E]">{field.label}{field.required && ' *'}<input aria-label={field.label} required={field.required} maxLength={field.key === 'targetRole' ? 200 : 300} type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'} value={input[field.key]} disabled={generating} onChange={event => setInput(current => ({ ...current, [field.key]: event.target.value }))} className={fieldClass} /></label>)}</div>
        <label className="mt-6 block text-xs font-semibold text-[#57534E]">Votre parcours *<textarea aria-label="Votre parcours" required minLength={20} maxLength={10000} rows={9} value={input.background} disabled={generating} onChange={event => setInput(current => ({ ...current, background: event.target.value }))} placeholder="Décrivez vos formations et dates, expériences, missions, projets, compétences et langues. Vous pouvez écrire librement ou coller vos notes. Indiquez les niveaux uniquement si vous souhaitez les faire apparaître." className={`${fieldClass} leading-relaxed`} /><span className="mt-2 block font-normal text-[#A8A29E]">Vous fournissez les faits ; l’IA s’occupe de la rédaction et de la mise en page.</span></label>
        <label className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-[#78716C]"><input type="checkbox" checked={consent} disabled={generating} onChange={event => setConsent(event.target.checked)} className="mt-0.5 accent-[#621E3E]" />J’autorise l’envoi de mon parcours et du poste recherché à Groq via Supabase pour générer ce CV. Les coordonnées des champs ci-dessus sont ajoutées localement ; évitez de les recopier dans votre parcours.</label>
        <button type="submit" disabled={!consent || generating || preparingPhoto} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#621E3E] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-45">{generating ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}{generating ? 'L’IA rédige et organise votre CV…' : 'Générer mon CV avec l’IA'}{!generating && <ArrowRight size={17} />}</button>
      </form>
    </section> : <div>
      <div className="mx-auto mb-5 flex max-w-[794px] flex-wrap items-center justify-between gap-3"><div><p role="status" className="text-sm font-semibold text-[#1C1917]">Votre CV est prêt</p><p className="mt-1 text-xs text-[#78716C]">{company ? 'Contenu et présentation générés pour cette entreprise.' : 'Contenu et présentation générés à partir de votre parcours.'} Relisez les informations.</p></div><button onClick={download} disabled={generating} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-3 text-sm font-bold text-white disabled:opacity-45"><Download size={16} />Télécharger le PDF</button></div>
      <div aria-label="Présentation du CV" className="mx-auto mb-5 max-w-[794px] rounded-xl border border-[#EAE5E0] bg-white p-4"><p className="mb-3 text-xs font-semibold text-[#57534E]">Présentation · 5 modèles</p><div className="flex flex-wrap gap-2">{cvLayouts.map(layout => <button key={layout.value} disabled={generating} aria-pressed={cv.layout === layout.value} onClick={() => setCv(current => current ? { ...current, layout: layout.value } : current)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-45 ${cv.layout === layout.value ? 'border-[#621E3E] bg-[#621E3E] text-white' : 'border-[#EAE5E0] text-[#57534E] hover:bg-[#FBF9F7]'}`}>{layout.label}</button>)}</div></div>
      <CvDocument cv={cv} />
      <div className="mx-auto mt-5 flex max-w-[794px] flex-wrap gap-3"><button disabled={generating} onClick={() => { setCv(null); setError(''); }} className="flex items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white px-4 py-3 text-sm font-semibold text-[#57534E] disabled:opacity-45"><Pencil size={15} />Modifier mes informations</button><button disabled={generating} onClick={() => void generate()} className="flex items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white px-4 py-3 text-sm font-semibold text-[#621E3E] disabled:opacity-45">{generating ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}{generating ? 'Génération…' : 'Générer une autre version'}</button></div>
    </div>}
    {error && <p role="alert" className="mx-auto mt-4 max-w-3xl rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
  </div>;
}
