import { useState } from 'react';
import { ChevronDown, Filter, Search } from 'lucide-react';
import { CompanyCard, CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';

export default function CompaniesScreen({ companies, loading, error, favs, onFav, onView, onApply }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void; onApply: (c: Company) => void }) {
  const [search, setSearch] = useState('');
  const [domaine, setDomaine] = useState('All');
  const domaines = ['All', ...Array.from(new Set(companies.map(c => c.domaine).filter((value): value is string => Boolean(value))))];

  const filtered = companies.filter(c =>
    (domaine === 'All' || c.domaine === domaine) &&
    (c.nom.toLowerCase().includes(search.toLowerCase()) || (c.domaine || '').toLowerCase().includes(search.toLowerCase()) || (c.sous_domaine || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <PageHeader title="Explore Companies" sub={`${companies.length} companies in Marrakech`} />

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-lg">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies, sectors, skills..."
            className="w-full bg-white border border-[#EAE5E0] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#621E3E]"
          />
        </div>
        <div className="relative">
          <select value={domaine} onChange={e => setDomaine(e.target.value)} className="appearance-none bg-white border border-[#EAE5E0] rounded-xl px-4 py-2.5 pr-8 text-sm text-[#1C1917] focus:outline-none">
            {domaines.map(s => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A8A29E] pointer-events-none" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#EAE5E0] rounded-xl text-sm text-[#78716C] hover:bg-[#FBF9F7] transition-colors">
          <Filter size={13} /> Filters
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <CompanyStatus loading={loading} error={error} />
        {filtered.map(c => (
          <CompanyCard key={c.id} company={c} isFav={favs.has(c.id)} onFav={onFav} onView={onView} onApply={onApply} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-4 py-16 text-center text-[#A8A29E]">No companies match your search.</div>
        )}
      </div>
    </div>
  );
}
