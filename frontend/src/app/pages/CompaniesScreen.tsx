import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CompanyCard, CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';
import FilterSelect from '../components/FilterSelect';
import { buildCompanySearchDocuments, runCompanySearch } from '../companySearch';
import { useCompanyActivityIndex } from '../hooks/useCompanyActivityIndex';

export default function CompaniesScreen({ companies, loading, error, favs, onFav, onView, onApply, onTailoredCv }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void; onApply: (c: Company) => void; onTailoredCv: (c: Company) => void }) {
  const [search, setSearch] = useState('');
  const [settledSearch, setSettledSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search), search ? 220 : 0);
    return () => clearTimeout(timer);
  }, [search]);
  const analysing = settledSearch !== search;
  const [domaine, setDomaine] = useState('All');
  const activity = useCompanyActivityIndex();
  const domaines = ['All', ...Array.from(new Set(companies.map(c => c.domaine).filter((value): value is string => Boolean(value))))];

  const documents = useMemo(() => buildCompanySearchDocuments(companies, activity.pages), [companies, activity.pages]);
  const outcome = useMemo(() => runCompanySearch(documents, settledSearch, domaine), [documents, settledSearch, domaine]);
  const { analysis } = outcome;
  const partial = outcome.results.length === 0 && outcome.related.length > 0;
  const filtered = analysing ? [] : partial ? outcome.related : outcome.results;
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
            placeholder="Ex. Je cherche une entreprise en IA"
            maxLength={300}
            className="w-full bg-white border border-[#EAE5E0] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#621E3E]"
          />
          {search && <button onClick={() => setSearch('')} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#78716C] hover:text-[#621E3E]"><X size={14} /></button>}
        </div>
        <div className="w-full sm:w-60">
          <FilterSelect label="Filtrer les entreprises par domaine" value={domaine} onValueChange={setDomaine}
            options={domaines.map(value => ({ value, label: value === 'All' ? 'Tous les domaines' : value }))} />
        </div>
      </div>

      {searching && !analysing && (analysis.criteria.length > 0 || analysis.excluded.length > 0) && <div className="mb-4 rounded-xl border border-[#EAE5E0] bg-white p-3 text-xs text-[#57534E]">
        <p className="font-semibold text-[#621E3E]">Votre recherche, interprétée</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {analysis.criteria.map(label => <span key={label} className="rounded-full bg-[#621E3E]/5 px-2.5 py-1">{label}</span>)}
          {analysis.excluded.map(label => <span key={`exclude-${label}`} className="rounded-full bg-[#FBF9F7] px-2.5 py-1">Exclure : {label}</span>)}
        </div>
        {analysis.groups.length > 1 && <p className="mt-2">Au moins une des alternatives demandées.</p>}
        {analysis.corrections.length > 0 && <p className="mt-2">Correction : {analysis.corrections.map(item => `${item.from} → ${item.to}`).join(', ')}</p>}
        {analysis.recruitment && <p className="mt-2">Entreprises liées à votre activité recherchée. Leur présence ne confirme pas une offre de stage ou d’emploi.</p>}
      </div>}

      <div className="mb-4 text-xs text-[#78716C]" aria-live="polite" aria-atomic="true">
        {loading ? 'Chargement des entreprises…' : analysing ? 'Analyse de votre recherche…' : partial
          ? `Aucune correspondance complète. ${filtered.length} entreprise${filtered.length > 1 ? 's' : ''} avec une correspondance partielle pour « ${search.trim()} ».`
          : `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}${searching ? ` pour « ${search.trim()} »` : ''}`}
        {searching && activity.loading && <span className="block mt-1">Chargement des informations d’activité…</span>}
        {searching && activity.unavailable && <span className="block mt-1">Les descriptions des sites sont indisponibles. Recherche dans le catalogue uniquement.</span>}
        {!searching && <p className="mt-1">Un nom, une activité ou une phrase : « stage en IA », « infrastructure ou cloud », « marketing sans immobilier »…</p>}
      </div>

      <div aria-busy={analysing || loading} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <CompanyStatus loading={loading} error={error} />
        {filtered.map(({ company: c, evidence, missing }) => (
          <div key={c.id} className="min-w-0 flex flex-col [&>.company-card]:flex-1">
          {partial && <p className="mb-2 text-xs text-[#78716C]">Critères non retrouvés : {missing.join(', ')}</p>}
          <CompanyCard company={c} isFav={favs.has(c.id)} onFav={onFav} onView={onView} onApply={onApply} onTailoredCv={onTailoredCv} searchEvidence={evidence} />
          </div>
        ))}
        {filtered.length === 0 && !analysing && !loading && !error && !(searching && activity.loading) && (
          <div className="col-span-full py-16 text-center text-sm text-[#78716C]">{!analysis.criteria.length && !analysis.excluded.length
            ? 'Précisez une activité ou un nom d’entreprise, par exemple « stage en IA » ou « 212 Services ».'
            : 'Aucune entreprise du catalogue ne correspond aux informations disponibles. Essayez un autre mot-clé ou choisissez tous les domaines.'}</div>
        )}
      </div>
    </div>
  );
}
