import type { ProfileData } from '../types/profile';
import type { Company } from './types';

export function userInitials(name: string, email = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();
  return email[0]?.toUpperCase() || 'U';
}

export function matchColor(pct: number) {
  return pct >= 85 ? '#667436' : pct >= 70 ? '#621E3E' : '#D9828D';
}

export function companyMatch(company: Company) {
  const rawScore = company.score_priorite ?? company.note ?? 0;
  return Math.round(Math.max(0, Math.min(100, rawScore <= 10 ? rawScore * 20 : rawScore)));
}

export function companySkills(company: Company) {
  return [company.domaine, company.sous_domaine, company.categorie].filter((value): value is string => Boolean(value));
}

export function recommendationScore(company: Company, profile: ProfileData) {
  const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const profileText = normalize(`${profile.job_title} ${profile.education} ${profile.experience} ${profile.skills}`);
  const companyText = normalize(`${company.nom} ${company.domaine ?? ''} ${company.sous_domaine ?? ''} ${company.categorie ?? ''}`);
  if (!profileText.trim() || !companyText.trim()) return 0;

  const ignored = new Set(['avec', 'dans', 'pour', 'des', 'les', 'une', 'the', 'and', 'du', 'de', 'data']);
  const profileTerms = [...new Set(profileText.split(/[^a-z0-9+#.]+/).filter(term => term.length > 2 && !ignored.has(term)))];
  const directMatches = profileTerms.filter(term => companyText.includes(term)).length;
  const domains = [
    { company: ['it', 'digital', 'web', 'software', 'ia', 'tech'], profile: ['python', 'sql', 'javascript', 'typescript', 'develop', 'data', 'power', 'excel', 'web', 'informat'] },
    { company: ['marketing', 'communication', 'media', 'seo'], profile: ['marketing', 'communication', 'seo', 'content', 'social', 'canva', 'design'] },
    { company: ['finance', 'comptable', 'fiduciaire', 'audit'], profile: ['finance', 'comptab', 'audit', 'excel', 'gestion'] },
    { company: ['tourism', 'hotel', 'travel', 'concierge'], profile: ['tourism', 'hotel', 'travel', 'client', 'vente', 'service'] },
    { company: ['health', 'medical', 'sante'], profile: ['health', 'medical', 'sante', 'nursing', 'pharma'] },
  ];
  const semanticMatches = domains.filter(group => group.company.some(term => companyText.includes(term)) && group.profile.some(term => profileText.includes(term))).length;
  const profileCompleteness = [profile.job_title, profile.skills, profile.education, profile.experience].filter(value => value.trim()).length;
  return Math.min(100, Math.round(Math.min(directMatches, 4) * 14 + semanticMatches * 30 + profileCompleteness * 3));
}

export function companyAddress(company: Company) {
  return company.adresse || 'Adresse non renseignée';
}

export function mapPosition(company: Company, companies: Company[], axis: 'latitude' | 'longitude') {
  const coordinate = company[axis];
  const values = companies.map(item => item[axis]).filter((value): value is number => value !== null);
  if (coordinate === null || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 50 : ((coordinate - min) / (max - min)) * 100;
}
