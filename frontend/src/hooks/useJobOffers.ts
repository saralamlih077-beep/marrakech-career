import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface JobOffer {
  id: string;
  entreprise_id: number | null;
  title: string;
  contract_type: 'internship' | 'cdi' | 'cdd' | 'freelance' | 'full_time';
  location: string;
  description: string;
  requirements: string;
  skills: string[];
  source_name: string | null;
  source_url: string | null;
  created_at: string;
  expires_at: string | null;
  employer_name?: string | null;
  contact_email?: string | null;
  source_origin?: string | null;
  contract_label?: string | null;
  published_at?: string | null;
  publication_date_estimated?: boolean;
  offer_domain?: string | null;
  work_mode?: string | null;
  duration?: string | null;
  compensation?: string | null;
  education_level?: string | null;
  alternative_source_urls?: string[];
  entreprise?: { nom: string; email: string | null } | null;
}

export function useJobOffers() {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('job_offers')
        .select('id, entreprise_id, title, contract_type, location, description, requirements, skills, source_name, source_url, created_at, expires_at, employer_name, contact_email, source_origin, contract_label, published_at, publication_date_estimated, offer_domain, work_mode, duration, compensation, education_level, alternative_source_urls, entreprises(nom, email)')
        .eq('status', 'verified')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setOffers([]);
      } else {
        setError(null);
        setOffers((data ?? []).map((row: any) => ({ ...row, entreprise: Array.isArray(row.entreprises) ? row.entreprises[0] ?? null : row.entreprises ?? null })) as JobOffer[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  return { offers, loading, error };
}
