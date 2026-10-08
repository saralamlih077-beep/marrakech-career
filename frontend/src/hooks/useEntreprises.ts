import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Entreprise } from '../types/entreprise';

export interface EntrepriseFilters {
  recherche?: string;
  domaine?: string | string[];
  sous_domaine?: string | string[];
}

function toFilterValues(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export function useEntreprises(filters: EntrepriseFilters = {}) {
  const [data, setData] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    let isActive = true;
    let inFlight = false;
    let lastChecked = 0;

    async function fetchEntreprises(background = false) {
      if (inFlight) return;
      inFlight = true;
      lastChecked = Date.now();
      if (!background) { setLoading(true); setError(null); }

      const { data: rows, error: queryError } = await supabase.from('entreprises').select('*');
      inFlight = false;

      if (!isActive) return;

      if (queryError) {
        if (background) return;
        setData([]);
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const parsedRows = (rows ?? []) as unknown as Entreprise[];
      const normalizedFilters = JSON.parse(filterKey) as EntrepriseFilters;
      const recherche = normalizedFilters.recherche?.trim().toLocaleLowerCase() ?? '';
      const domaines = toFilterValues(normalizedFilters.domaine);
      const sousDomaines = toFilterValues(normalizedFilters.sous_domaine);

      const filteredRows = parsedRows
        .filter((entreprise) => {
          if (entreprise.is_active === false) return false;
          const matchesSearch = !recherche || entreprise.nom.toLocaleLowerCase().includes(recherche);
          const matchesDomaine = domaines.length === 0 || (entreprise.domaine !== null && domaines.includes(entreprise.domaine));
          const matchesSousDomaine = sousDomaines.length === 0 || (entreprise.sous_domaine !== null && sousDomaines.includes(entreprise.sous_domaine));
          return matchesSearch && matchesDomaine && matchesSousDomaine;
        })
        .sort((first, second) => {
          const firstScore = first.score_priorite ?? first.note ?? 0;
          const secondScore = second.score_priorite ?? second.note ?? 0;
          return secondScore - firstScore;
        });

      setData(filteredRows);
      setLoading(false);
    }

    void fetchEntreprises();
    const refresh = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastChecked >= 60_000) void fetchEntreprises(true);
    };
    const timer = window.setInterval(refresh, 5 * 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      isActive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [filterKey]);

  return { data, loading, error };
}
