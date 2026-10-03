import type { ProfileData } from '../types/profile';
import type { Entreprise } from '../types/entreprise';

export type CvInput = { fullName: string; targetRole: string; email: string; phone: string; city: string; linkedin: string; background: string; photoDataUrl?: string };
export type CvLayout = 'sidebar' | 'editorial' | 'minimal' | 'golden-columns' | 'sunshine';
export type CvPalette = 'navy' | 'forest' | 'charcoal';
export type CvSectionKind = 'experience' | 'education' | 'projects' | 'skills' | 'languages';
export type CvEntry = { heading: string; subheading: string; period: string; bullets: string[] };
export type CvSection = { kind: CvSectionKind; title: string; items: CvEntry[] };
export type GeneratedCv = { identity: Omit<CvInput, 'background'>; layout: CvLayout; palette: CvPalette; summary: string; sections: CvSection[] };
export const cvPalettes = { navy: '#243747', forest: '#304A40', charcoal: '#383B40' };
export const cvLayouts: Array<{ value: CvLayout; label: string }> = [{ value: 'sidebar', label: 'Colonne latérale' }, { value: 'editorial', label: 'Éditorial' }, { value: 'minimal', label: 'Minimal' }, { value: 'golden-columns', label: 'Deux colonnes dorées' }, { value: 'sunshine', label: 'Soleil' }];

export function profileToCvInput(profile: ProfileData, email: string): CvInput {
  return { fullName: profile.full_name, targetRole: profile.job_title, email, phone: profile.phone, city: profile.address, linkedin: profile.linkedin,
    background: [['Formation', profile.education], ['Expérience', profile.experience], ['Compétences', profile.skills], ['Projets', profile.projects], ['Langues', profile.languages]]
      .filter(([, value]) => value.trim()).map(([label, value]) => `${label} :\n${value}`).join('\n\n') };
}

export function cvGenerationRequest(company: Entreprise | null, input: CvInput, previousLayout?: CvLayout) {
  // Identity and contact fields are added to the document locally.
  return { company: company ? { name: company.nom.slice(0, 300), sector: (company.domaine || '').slice(0, 300), specialty: (company.sous_domaine || '').slice(0, 300), description: (company.about_summary || '').slice(0, 1500) } : null, candidate: { targetRole: input.targetRole, background: input.background }, previousLayout };
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function safeText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Le CV généré est incomplet. Relancez la génération.');
  return value.trim();
}
export function parseGeneratedCv(value: unknown, input: CvInput): GeneratedCv {
  const cv = value as Record<string, unknown> | null;
  if (!cv || !cvLayouts.some(layout => layout.value === cv.layout) || !['navy', 'forest', 'charcoal'].includes(String(cv.palette)) || !Array.isArray(cv.sections) || cv.sections.length > 5) throw new Error('La présentation générée est invalide. Réessayez.');
  const source = normalize(input.background);
  const seen = new Set<string>();
  const sections: CvSection[] = cv.sections.map(raw => {
    if (!raw || !['experience', 'education', 'projects', 'skills', 'languages'].includes(raw.kind) || seen.has(raw.kind) || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 20) throw new Error('Les rubriques générées sont invalides. Réessayez.');
    seen.add(raw.kind);
    const items = raw.items.map((item: Record<string, unknown>): CvEntry => {
      if (!item) throw new Error('Une rubrique est incomplète. Réessayez.');
      const quote = safeText(item.sourceQuote, 1500);
      const quotedFact = normalize(quote).replace(/^(?:formation|experience|projets?|competences?|langues?) /, '');
      if (!quotedFact || !source.includes(quotedFact)) throw new Error('Une information générée ne correspond pas à votre parcours. Relancez la génération.');
      if (!Array.isArray(item.bullets) || item.bullets.length > 6) throw new Error('Une rubrique est trop longue. Réessayez.');
      const heading = safeText(item.heading, 200);
      const subheading = safeText(item.subheading, 250);
      if (!heading) throw new Error('Une rubrique est incomplète. Réessayez.');
      if (['skills', 'languages'].includes(raw.kind) && (!source.includes(normalize(heading)) || (subheading && !normalize(quote).includes(normalize(subheading))))) throw new Error('Une compétence ou un niveau a été ajouté sans information source. Réessayez.');
      return { heading, subheading, period: safeText(item.period, 100), bullets: item.bullets.map(bullet => safeText(bullet, 600)) };
    });
    return { kind: raw.kind, title: safeText(raw.title, 70), items };
  });
  // Remove unsupported promotional sentences rather than displaying invented levels.
  const unsupported = ['maîtrise', 'expert', 'passionné', 'travail en équipe', 'solide', 'autonome', 'projets personnels'].filter(claim => !source.includes(normalize(claim)));
  const summary = safeText(cv.summary, 1300).split(/(?<=[.!?])\s+/).filter(sentence => !unsupported.some(claim => normalize(sentence).includes(normalize(claim)))).join(' ');
  if (!summary || !sections.length) throw new Error('Le résumé généré ne correspond pas assez à votre parcours. Relancez la génération.');
  const { background: _background, ...identity } = input;
  return { identity, layout: cv.layout as CvLayout, palette: cv.palette as CvPalette, summary, sections };
}
