import { useEffect, useState } from 'react';
import {
  ArrowLeft, Award, Briefcase, Check, Download, FileSearch, FileText, Globe, ImagePlus, Palette, Plus, Sparkles, Target, User,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useProfile } from '../../hooks/useProfile';
import type { ProfileData } from '../../types/profile';

const cvThemes = [
  { name: 'Bordeaux', primary: '#621E3E', accent: '#FFEC8E' },
  { name: 'Bleu marine', primary: '#173B63', accent: '#B9E3FF' },
  { name: 'Vert forêt', primary: '#24523D', accent: '#D6EAA6' },
  { name: 'Violet', primary: '#4A2A68', accent: '#E2C7FF' },
  { name: 'Anthracite', primary: '#30343B', accent: '#E7D7AA' },
];

export default function CVStudioScreen({ onAnalyze }: { onAnalyze: () => void }) {
  const [showEditor, setShowEditor] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const { profile, email, userId, saving, saveProfile } = useProfile();
  const [draft, setDraft] = useState(profile);
  const [newSkill, setNewSkill] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const theme = cvThemes[themeIndex];
  useEffect(() => setDraft(profile), [profile]);
  const photoStorageKey = userId ? `marrakech-career-cv-photo:${userId}` : '';
  useEffect(() => {
    if (!photoStorageKey) return;
    try {
      setPhotoDataUrl('');
      const savedPhoto = window.localStorage.getItem(photoStorageKey);
      if (savedPhoto) {
        setPhotoDataUrl(savedPhoto);
        return;
      }
      const legacyKey = email ? `marrakech-career-cv-photo:${email.toLocaleLowerCase()}` : '';
      const legacyPhoto = legacyKey ? window.localStorage.getItem(legacyKey) : null;
      if (legacyPhoto) {
        window.localStorage.setItem(photoStorageKey, legacyPhoto);
        setPhotoDataUrl(legacyPhoto);
      }
    } catch {
      setPhotoError('La photo ne peut pas être restaurée dans ce navigateur.');
    }
  }, [photoStorageKey]);
  const updateDraft = (key: keyof ProfileData, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const sectionField: Partial<Record<string, keyof ProfileData>> = { education: 'education', experience: 'experience', projects: 'projects', languages: 'languages' };
  const addEntry = () => {
    const field = sectionField[activeSection];
    if (field) updateDraft(field, `${draft[field]}${draft[field] ? '\n' : ''}Nouvelle entrée`);
    if (activeSection === 'skills') updateDraft('skills', `${draft.skills}${draft.skills ? ', ' : ''}Nouvelle compétence`);
  };
  const addSkill = () => {
    const skill = newSkill.trim();
    if (!skill) return;
    updateDraft('skills', `${draft.skills}${draft.skills ? ', ' : ''}${skill}`);
    setNewSkill('');
  };
  const removeSkill = (skillToRemove: string) => {
    updateDraft('skills', draft.skills.split(',').map(skill => skill.trim()).filter(skill => skill && skill !== skillToRemove).join(', '));
  };
  const exportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 18;
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 22;
      const addSection = (title: string, content: string) => {
        if (!content.trim()) return;
        if (y > 265) { pdf.addPage(); y = 22; }
        pdf.setTextColor(theme.primary);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(title.toUpperCase(), margin, y);
        y += 7;
        pdf.setTextColor('#57534E');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(content, pageWidth - margin * 2);
        pdf.text(lines, margin, y);
        y += lines.length * 5 + 8;
      };
      pdf.setFillColor(theme.primary);
      pdf.rect(0, 0, pageWidth, 45, 'F');
      pdf.setTextColor('#FFFFFF');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text(draft.full_name || 'Marrakech Career CV', margin, 18);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text(draft.job_title || 'Professional profile', margin, 27);
      pdf.setFontSize(9);
      pdf.text([email, draft.phone, draft.address, draft.linkedin].filter(Boolean).join('  |  '), margin, 36);
      if (photoDataUrl) {
        const photoFormat = photoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(photoDataUrl, photoFormat, pageWidth - margin - 25, 10, 25, 25);
      }
      y = 58;
      addSection('Profile', draft.experience);
      addSection('Education', draft.education);
      addSection('Skills', draft.skills);
      addSection('Experience', draft.experience);
      addSection('Projects', draft.projects);
      addSection('Languages', draft.languages);
      pdf.save(`${(draft.full_name || 'marrakech-career-cv').trim().replace(/\s+/g, '-').toLowerCase()}.pdf`);
    } catch {
      setExportError('Impossible de générer le PDF. Réessayez.');
    } finally {
      setExporting(false);
    }
  };
  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Utilisez une photo JPG ou PNG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('La photo ne doit pas dépasser 2 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      try {
        if (photoStorageKey && dataUrl) window.localStorage.setItem(photoStorageKey, dataUrl);
        setPhotoDataUrl(dataUrl);
      } catch {
        setPhotoError('La photo est trop grande pour être conservée dans ce navigateur. Choisissez une image plus légère.');
      }
    };
    reader.onerror = () => setPhotoError('Impossible de lire cette photo.');
    reader.readAsDataURL(file);
  };

  const sections = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'education', label: 'Education', icon: Award },
    { id: 'skills', label: 'Skills', icon: Sparkles },
    { id: 'experience', label: 'Experience', icon: Briefcase },
    { id: 'projects', label: 'Projects', icon: Target },
    { id: 'languages', label: 'Languages', icon: Globe },
  ];

  // Première étape volontairement simple : l’utilisateur choisit d’abord
  // entre analyser son CV existant ou créer son premier CV.
  if (!showEditor) {
    return (
      <div className="flex-1 overflow-auto bg-[#FBF9F7] p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-[#1C1917]">Studio CV</h1>
            <p className="mt-1 text-sm text-[#78716C]">Commencez par analyser un CV existant ou créez le vôtre étape par étape.</p>
          </div>

          <section className="rounded-2xl border border-[#C6C954]/45 bg-white p-7 shadow-sm">
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#C6C954]/20 text-[#667436]"><FileSearch size={23} /></div>
              <div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-[#1C1917]">Analyser mon CV</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#78716C]">Téléversez votre CV PDF, DOCX ou TXT. L’analyse détecte les compétences réellement présentes et propose des conseils liés au document.</p><button onClick={onAnalyze} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#667436] px-5 py-3 text-sm font-bold text-white hover:bg-[#52592b]"><FileSearch size={16} /> Analyser un CV existant</button></div>
            </div>
          </section>

          <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#A8A29E]"><span className="h-px flex-1 bg-[#EAE5E0]" />ou<span className="h-px flex-1 bg-[#EAE5E0]" /></div>

          <section className="rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm">
            <div className="flex flex-wrap items-start gap-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#621E3E]/10 text-[#621E3E]"><FileText size={23} /></div><div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-[#1C1917]">Vous n’avez pas encore de CV ?</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#78716C]">Créez-en un professionnel : renseignez vos informations, compétences, formation, expériences et projets. Vous pourrez ensuite choisir une couleur, ajouter une photo et exporter le PDF.</p><button onClick={() => setShowEditor(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#621E3E] px-5 py-3 text-sm font-bold text-white hover:bg-[#4e1830]"><FileText size={16} /> Créer mon CV</button></div></div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-72 bg-white border-r border-[#EAE5E0] flex flex-col">
        <div className="px-5 py-4 border-b border-[#EAE5E0]">
          <button onClick={() => setShowEditor(false)} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[#621E3E] hover:underline"><ArrowLeft size={13} /> Accueil du Studio</button>
          <h2 className="text-sm font-bold text-[#1C1917]">Créer mon CV</h2>
          <p className="text-xs text-[#78716C]">Build your professional CV</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)} className={`w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors border-l-2 ${activeSection === id ? 'border-[#621E3E] bg-[#621E3E]/5 text-[#621E3E] font-semibold' : 'border-transparent text-[#78716C] hover:bg-[#FBF9F7]'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-[#EAE5E0] space-y-2">
          <label className="w-full flex items-center justify-center gap-2 py-2 bg-[#C6C954]/20 text-[#4a4d1a] rounded-xl text-xs font-bold border border-[#C6C954]/40 hover:bg-[#C6C954]/30 transition-colors cursor-pointer">
            <ImagePlus size={13} /> {photoDataUrl ? 'Changer la photo' : 'Ajouter une photo'}
            <input type="file" accept="image/jpeg,image/png" onChange={handlePhoto} className="hidden" />
          </label>
          {photoDataUrl && <button type="button" onClick={() => { setPhotoDataUrl(''); if (photoStorageKey) window.localStorage.removeItem(photoStorageKey); }} className="w-full text-[11px] font-semibold text-[#78716C] hover:text-red-700">Supprimer la photo</button>}
          {photoError && <p className="rounded-lg bg-[#FFEC8E]/30 px-2.5 py-2 text-[11px] leading-relaxed text-[#6B5500]">{photoError}</p>}
          <button onClick={onAnalyze} className="w-full flex items-center justify-center gap-2 py-2 bg-[#667436] text-white rounded-xl text-xs font-bold hover:bg-[#52592b] transition-colors">
            <FileSearch size={12} /> Analyze CV
          </button>
          <button onClick={() => void saveProfile(draft)} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-[#EAE5E0] text-[#621E3E] rounded-xl text-xs font-bold disabled:opacity-60">
            <Check size={12} /> {saving ? 'Saving...' : 'Save CV data'}
          </button>
          <button onClick={() => void exportPdf()} disabled={exporting} className="w-full flex items-center justify-center gap-2 py-2 bg-[#621E3E] text-white rounded-xl text-xs font-bold hover:bg-[#4e1830] transition-colors disabled:opacity-60">
            <Download size={12} /> {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
          {exportError && <p className="text-xs text-red-700">{exportError}</p>}
        </div>
      </div>

      <div className="w-80 border-r border-[#EAE5E0] bg-[#FBF9F7] p-5 overflow-y-auto">
        <div className="space-y-4">
          {activeSection === 'personal' && (
            <>
              {[
                ['Full Name', 'full_name', draft.full_name],
                ['Job Title', 'job_title', draft.job_title],
                ['Email', 'email', email],
                ['Phone', 'phone', draft.phone],
                ['LinkedIn', 'linkedin', draft.linkedin],
                ['Location', 'address', draft.address],
              ].map(([label, key, val]) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-[#57534E] mb-1.5 block">{label}</label>
                  <input value={val} readOnly={key === 'email'} onChange={event => key !== 'email' && updateDraft(key as keyof ProfileData, event.target.value)} className="w-full bg-white border border-[#EAE5E0] rounded-xl px-3 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#621E3E]" />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-[#57534E] mb-1.5 block">Professional Summary</label>
                <textarea rows={4} value={draft.experience} onChange={event => updateDraft('experience', event.target.value)} className="w-full bg-white border border-[#EAE5E0] rounded-xl px-3 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#621E3E] resize-none" placeholder="Votre résumé et expérience" />
              </div>
            </>
          )}
          {activeSection === 'skills' && (
            <div>
              <p className="text-xs font-semibold text-[#57534E] mb-3">Skills & Proficiency</p>
              {draft.skills.split(',').map(skill => skill.trim()).filter(Boolean).map(sk => (
                <div key={sk} className="mb-3 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1"><span className="font-medium text-[#1C1917]">{sk}</span><span className="text-[#78716C]">Profil</span></div>
                  <div className="h-1.5 bg-[#EAE5E0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#621E3E] rounded-full" style={{ width: '100%' }} />
                  </div>
                  </div>
                  <button onClick={() => removeSkill(sk)} aria-label={`Supprimer ${sk}`} className="text-xs text-[#A8A29E] hover:text-red-700">×</button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input value={newSkill} onChange={event => setNewSkill(event.target.value)} onKeyDown={event => event.key === 'Enter' && addSkill()} placeholder="Écrire une compétence" className="min-w-0 flex-1 bg-white border border-[#EAE5E0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#621E3E]" />
                <button onClick={addSkill} className="px-3 rounded-xl border border-[#EAE5E0] text-[#621E3E] text-xs font-semibold"><Plus size={12} /></button>
              </div>
            </div>
          )}
          {activeSection !== 'personal' && activeSection !== 'skills' && (
            <div className="text-center py-8 text-[#A8A29E]">
              <FileText size={24} className="mx-auto mb-2" />
              <textarea value={draft[sectionField[activeSection] ?? 'education']} onChange={event => sectionField[activeSection] && updateDraft(sectionField[activeSection]!, event.target.value)} placeholder={`Ajoutez ${sections.find(s => s.id === activeSection)?.label}`} rows={4} className="w-full bg-white border border-[#EAE5E0] rounded-xl px-3 py-2 text-sm text-[#57534E] focus:outline-none focus:border-[#621E3E]" />
              <button onClick={addEntry} className="mt-3 flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-dashed border-[#EAE5E0] rounded-xl text-xs text-[#78716C] hover:border-[#621E3E] mx-auto transition-colors">
                <Plus size={12} /> Add entry
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-[#E8E0D8] overflow-auto flex flex-col">
        <div className="px-5 py-3 bg-white border-b border-[#EAE5E0] flex items-center gap-3">
          <p className="text-xs font-semibold text-[#57534E]">Template:</p>
          <span className="text-xs px-3 py-1 rounded-lg text-white font-medium" style={{ backgroundColor: theme.primary }}>Modern</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Palette size={14} className="text-[#78716C]" />
            <span className="text-xs font-semibold text-[#57534E] mr-1">Couleur</span>
            {cvThemes.map((item, index) => (
              <button key={item.name} type="button" onClick={() => setThemeIndex(index)} title={item.name} aria-label={`Couleur ${item.name}`} className={`w-5 h-5 rounded-full transition-transform ${themeIndex === index ? 'ring-2 ring-offset-2 ring-[#1C1917] scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: item.primary }} />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 flex items-start justify-center overflow-auto">
          <div className="bg-white shadow-xl rounded-xl w-[520px] min-h-[720px] overflow-hidden">
            <div className="px-8 py-6 text-white" style={{ backgroundColor: theme.primary }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold">{draft.full_name || 'Nom non renseigné'}</h2>
                  <p className="text-sm mt-0.5" style={{ color: theme.accent }}>{draft.job_title || 'Poste non renseigné'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-white/80">
                    <span>{email}</span>
                    <span>{draft.address}</span>
                    <span>{draft.phone}</span>
                    {draft.linkedin && <span>{draft.linkedin}</span>}
                  </div>
                </div>
                {photoDataUrl && <img src={photoDataUrl} alt="Photo du candidat" className="w-20 h-20 rounded-full object-cover border-2 border-white/70 shrink-0" />}
              </div>
            </div>
            <div className="px-8 py-5">
              <p className="text-xs text-[#57534E] leading-relaxed mb-5">{draft.experience || 'Ajoutez votre résumé professionnel.'}</p>
              {[{ title: 'Education', items: [draft.education || 'Non renseignée'] }, { title: 'Skills', items: [draft.skills || 'Non renseignées'] }, { title: 'Experience', items: [draft.experience || 'Non renseignée'] }, { title: 'Projects', items: [draft.projects || 'Non renseignés'] }, { title: 'Languages', items: [draft.languages || 'Non renseignées'] }].map(({ title, items }) => (
                <div key={title} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.primary }}>{title}</h3>
                    <div className="flex-1 h-px bg-[#EAE5E0]" />
                  </div>
                  {items.map((item, i) => <p key={i} className="text-xs text-[#57534E] mb-1">{item}</p>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
