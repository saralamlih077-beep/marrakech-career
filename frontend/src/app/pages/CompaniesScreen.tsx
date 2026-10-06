import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CompanyCard, CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';
import FilterSelect from '../components/FilterSelect';
import { buildCompanySearchDocuments, searchCompanyDocuments } from '../companySearch';
import { useCompanyActivityIndex } from '../hooks/useCompanyActivityIndex';

export default function CompaniesScreen({ companies, loading, error, favs, onFav, onView, onApply, onTailoredCv }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void; onApply: (c: Company) => void; onTailoredCv: (c: Company) => void }) {
  const [search, setSearch] = useState('');
  const [domaine, setDomaine] = useState('All');
  const activity = useCompanyActivityIndex();
  const domaines = ['All', ...Array.from(new Set(companies.map(c => c.domaine).filter((value): value is string => Boolean(value))))];

  const documents = useMemo(() => buildCompanySearchDocuments(companies, activity.pages), [companies, activity.pages]);
  const filtered = useMemo(() => searchCompanyDocuments(documents, search, domaine), [documents, search, domaine]);
  const searching = Boolean(search.trim());

  return (
    <div className="min-w-0 flex-1 overflow-auto bg-[#FBF9F7] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Explorer les entreprises" sub={`${companies.length} entreprises à Marrakech`} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-lg">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Rechercher une entreprise ou une activité"
            placeholder="Nom, activité… ex. IA, infrastructure"
            className="w-full bg-white border border-[#EAE5E0] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#621E3E]"
          />
          {search && <button onClick={() => setSearch('')} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#78716C] hover:text-[#621E3E]"><X size={14} /></button>}
        </div>
        <div className="w-full sm:w-60">
          <FilterSelect label="Filtrer les entreprises par domaine" value={domaine} onValueChange={setDomaine}
            options={domaines.map(value => ({ value, label: value === 'All' ? 'Tous les domaines' : value }))} />
        </div>
      </div>

      <div className="mb-4 text-xs text-[#78716C]" aria-live="polite" aria-atomic="true">
        {loading ? 'Chargement des entreprises…' : `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}${searching ? ` pour « ${search.trim()} »` : ''}`}
        {searching && activity.loading && <span className="block mt-1">Chargement des informations d’activité…</span>}
        {searching && activity.unavailable && <span className="block mt-1">Les descriptions des sites sont indisponibles. Recherche dans le catalogue uniquement.</span>}
        {!searching && <p className="mt-1">Recherchez un nom ou un métier : IA, intelligence artificielle, réseaux, infrastructure…</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <CompanyStatus loading={loading} error={error} />
        {filtered.map(({ company: c, evidence }) => (
          <CompanyCard key={c.id} company={c} isFav={favs.has(c.id)} onFav={onFav} onView={onView} onApply={onApply} onTailoredCv={onTailoredCv} searchEvidence={evidence} />
        ))}
        {filtered.length === 0 && !loading && !error && !(searching && activity.loading) && (
          <div className="col-span-full py-16 text-center text-[#78716C]">Aucune entreprise ne correspond. Essayez un autre mot-clé ou choisissez tous les domaines.</div>
        )}
      </div>
    </div>
  );
}
