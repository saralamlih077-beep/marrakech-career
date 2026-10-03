import type { Company } from './types';

const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();
const contains = (text: string, phrase: string) => Boolean(phrase.trim()) && ` ${text} `.includes(` ${normalize(phrase)} `);

// Company records describe their activities, rather than verified job requirements.
// Match those activities to evidence in the uploaded document; never use account data or ratings.
const sectors = [
  { label: 'Informatique et digital', domains: ['IT & Digital'], companyTerms: ['informatique', 'software', 'web', 'logiciels', 'cybersecurite'], terms: ['React', 'JavaScript', 'TypeScript', 'Python', 'SQL', 'Java', 'PHP', 'HTML', 'CSS', 'C++', 'C#', 'Angular', 'Node.js', 'Développement web', 'Développeur', 'Informatique', 'Data analyst', 'Data science', 'Machine learning', 'DevOps', 'Cybersécurité'] },
  { label: 'Marketing et communication', domains: ['Marketing & Communication'], companyTerms: ['marketing', 'communication', 'publicite', 'seo', 'graphiste'], terms: ['Marketing', 'Communication', 'SEO', 'Publicité', 'Community management', 'Réseaux sociaux', 'Social media', 'Canva', 'Graphisme', 'Adobe Photoshop', 'Adobe Illustrator', 'Création de contenu'] },
  { label: 'Finance et comptabilité', domains: ['Finance & Assurance', 'Finance & Consulting'], companyTerms: ['comptable', 'comptabilite', 'fiduciaire', 'audit', 'finance', 'assurance'], terms: ['Comptabilité', 'Comptable', 'Finance', 'Audit', 'Fiscalité', 'Assurance', 'Bilan comptable', 'Sage', 'Gestion financière'] },
  { label: 'Tourisme et hôtellerie', domains: ['Tourisme & Hôtellerie', 'Tourism & Hospitality'], companyTerms: ['hotel', 'hotellerie', 'tourisme', 'agence de voyage', 'restaurant'], terms: ['Tourisme', 'Hôtellerie', 'Réceptionniste', 'Réception hôtelière', 'Restauration', 'Gestion hôtelière', 'Cuisine', 'Agence de voyage', 'Hospitality'] },
  { label: 'Commerce et distribution', domains: ['Commerce & Distribution'], companyTerms: ['commerce', 'distribution', 'magasin', 'vente'], terms: ['Vente', 'Commerce', 'Commercial', 'Distribution', 'Merchandising', 'E-commerce', 'Gestion de magasin', 'Prospection commerciale', 'Négociation commerciale'] },
  { label: 'Santé', domains: ['Santé', 'Healthcare'], companyTerms: ['sante', 'medical', 'clinique', 'pharmacie', 'laboratoire d analyse medicale'], terms: ['Santé', 'Médical', 'Infirmier', 'Infirmière', 'Soins infirmiers', 'Pharmacie', 'Biologie médicale', 'Médecine', 'Kinésithérapie', 'Nursing'] },
  { label: 'Immobilier et construction', domains: ['Immobilier & Construction', 'Architecture & Design'], companyTerms: ['immobilier', 'construction', 'architecture', 'batiment', 'genie civil'], terms: ['Immobilier', 'Construction', 'Architecture', 'Architecte', 'Génie civil', 'Bâtiment', 'AutoCAD', 'Revit', 'BIM', 'Gestion de chantier'] },
  { label: 'Éducation et formation', domains: ['Éducation & Formation'], companyTerms: ['enseignement', 'formation', 'ecole', 'education'], terms: ['Enseignement', 'Enseignant', 'Enseignante', 'Pédagogie', 'Formateur', 'Formatrice', 'Animation pédagogique', 'Éducation'] },
  { label: 'Industrie et logistique', domains: ['Industrie & Logistique'], companyTerms: ['industrie', 'logistique', 'transport', 'fabrication', 'maintenance industrielle'], terms: ['Logistique', 'Supply chain', 'Industrie', 'Maintenance industrielle', 'Mécanique', 'Électrotechnique', 'Gestion de stock', 'Transport', 'Production industrielle', 'Qualité industrielle'] },
  { label: 'Services aux entreprises', domains: ['Services aux entreprises'], companyTerms: ['ressources humaines', 'recrutement', 'conseil en gestion'], terms: ['Ressources humaines', 'Recrutement', 'Gestion administrative', 'Gestion de projet', 'Gestion de projets', 'Project management', 'Conseil en gestion', 'Assistanat', 'Secrétariat'] },
];

export type CvCompanyRecommendation = {
  company: Company;
  sectors: string[];
  evidence: string[];
  sharedSkills: string[];
  relevance: number;
};

export function recommendCompaniesForCv(companies: Company[], cvText: string, detectedSkills: string[], limit = 6): CvCompanyRecommendation[] {
  const source = normalize(cvText.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ').replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' '));
  if (!source || limit <= 0) return [];
  const verifiedSkills = [...new Set(detectedSkills.map(skill => skill.trim()).filter(skill => contains(source, skill)))];
  const activeSectors = sectors.map(sector => ({ ...sector, evidence: sector.terms.filter(term => contains(source, term)) })).filter(sector => sector.evidence.length);
  const seen = new Set<number>();
  const recommendations: CvCompanyRecommendation[] = [];

  for (const company of companies) {
    if (seen.has(company.id) || !company.nom.trim()) continue;
    seen.add(company.id);
    const activity = normalize([company.domaine, company.sous_domaine, company.categorie].filter(Boolean).join(' '));
    const matchedSectors = activeSectors.filter(sector => sector.domains.some(domain => normalize(company.domaine || '') === normalize(domain)) || sector.companyTerms.some(term => contains(activity, term)));
    const sharedSkills = verifiedSkills.filter(skill => contains(activity, skill));
    if (!matchedSectors.length && !sharedSkills.length) continue;
    const evidence = [...new Set([...sharedSkills, ...matchedSectors.flatMap(sector => sector.evidence)])];
    recommendations.push({ company, sectors: matchedSectors.map(sector => sector.label), evidence: evidence.slice(0, 4), sharedSkills,
      relevance: sharedSkills.length * 20 + matchedSectors.length * 10 + Math.min(evidence.length, 6),
    });
  }
  return recommendations.sort((a, b) => b.relevance - a.relevance || a.company.nom.localeCompare(b.company.nom, 'fr') || a.company.id - b.company.id).slice(0, limit);
}
