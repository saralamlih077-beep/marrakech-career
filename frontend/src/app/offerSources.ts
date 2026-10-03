import type { JobOffer } from '../hooks/useJobOffers';

const knownSources: Record<string, { label: string; order: number }> = {
  trabajo: { label: 'Trabajo', order: 0 },
  jobsquare: { label: 'JobSquare', order: 1 },
  joobaz: { label: 'Joobaz', order: 2 },
  maremploi: { label: 'Maremploi', order: 3 },
  'offres-emploi.ma': { label: 'Offres-emploi.ma', order: 4 },
  jooble: { label: 'Jooble', order: 5 },
  job_opportunities_api: { label: 'Job Opportunities API', order: 6 },
  manual: { label: 'Autres sources', order: 100 },
};

export function offerSourceKey(offer: Pick<JobOffer, 'source_name'>): string {
  return offer.source_name?.trim().toLowerCase() || 'manual';
}

export function offerSourceLabel(offer: Pick<JobOffer, 'source_name'>): string {
  return knownSources[offerSourceKey(offer)]?.label || offer.source_name?.trim() || 'Autres sources';
}

export function offerEmployerName(offer: Pick<JobOffer, 'entreprise' | 'employer_name'>): string {
  return offer.entreprise?.nom || offer.employer_name || 'Entreprise non précisée';
}

export function offerContractLabel(offer: Pick<JobOffer, 'contract_type' | 'contract_label'>): string {
  const labels: Record<JobOffer['contract_type'], string> = { internship: 'Stage', cdi: 'CDI', cdd: 'CDD', freelance: 'Freelance', full_time: 'Temps plein' };
  const label = labels[offer.contract_type];
  return offer.contract_type === 'internship' && offer.contract_label === 'Temps plein' ? 'Stage · Temps plein' : label || offer.contract_label || 'Contrat non précisé';
}

export function isOfferAvailable(offer: Pick<JobOffer, 'expires_at'>, now = Date.now()): boolean {
  return !offer.expires_at || new Date(offer.expires_at).getTime() > now;
}

export function groupOffersBySource(offers: JobOffer[], now = Date.now()) {
  const groups = new Map<string, { key: string; label: string; offers: JobOffer[] }>();
  for (const offer of offers) {
    if (!isOfferAvailable(offer, now)) continue;
    const key = offerSourceKey(offer);
    if (!groups.has(key)) groups.set(key, { key, label: offerSourceLabel(offer), offers: [] });
    groups.get(key)!.offers.push(offer);
  }
  return [...groups.values()].sort((a, b) => (knownSources[a.key]?.order ?? 50) - (knownSources[b.key]?.order ?? 50) || a.label.localeCompare(b.label, 'fr'));
}
