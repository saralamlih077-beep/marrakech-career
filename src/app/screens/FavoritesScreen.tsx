import { BriefcaseBusiness, ExternalLink, Heart, MapPin } from 'lucide-react';
import { useState } from 'react';
import { CompanyCard, CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';
import { useJobOffers } from '../../hooks/useJobOffers';
import { useOfferFavorites } from '../../hooks/useOfferFavorites';

export default function FavoritesScreen({ companies, loading, error, favs, onFav, onView }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void }) {
  const [category, setCategory] = useState<'companies' | 'offers'>('companies');
  const saved = companies.filter(c => favs.has(c.id));
  const { offers, loading: offersLoading, error: offersError } = useJobOffers();
  const { favoriteOffers, toggleOfferFavorite } = useOfferFavorites();
  const savedOffers = offers.filter(offer => favoriteOffers.has(offer.id));

  return (
    <div className="min-w-0 flex-1 overflow-auto bg-[#FBF9F7] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Favoris" sub={`${saved.length} entreprise${saved.length > 1 ? 's' : ''} et ${savedOffers.length} offre${savedOffers.length > 1 ? 's' : ''} enregistrée${savedOffers.length > 1 ? 's' : ''}`} />
      <div className="mb-6 grid w-full grid-cols-2 gap-1 rounded-xl bg-[#EAE5E0] p-1 sm:flex sm:w-fit">
        <button type="button" onClick={() => setCategory('companies')} className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs font-bold transition sm:px-4 sm:text-sm ${category === 'companies' ? 'bg-white text-[#1C1917] shadow-sm' : 'text-[#78716C]'}`}><Heart size={14} /> Entreprises favorites <span className="rounded-full bg-[#F1ECE7] px-2 py-0.5 text-[11px]">{saved.length}</span></button>
        <button type="button" onClick={() => setCategory('offers')} className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs font-bold transition sm:px-4 sm:text-sm ${category === 'offers' ? 'bg-white text-[#1C1917] shadow-sm' : 'text-[#78716C]'}`}><BriefcaseBusiness size={14} /> Offres favorites <span className="rounded-full bg-[#F1ECE7] px-2 py-0.5 text-[11px]">{savedOffers.length}</span></button>
      </div>
      {category === 'companies' && <>
      <CompanyStatus loading={loading} error={error} />
      {saved.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={32} className="text-[#EAE5E0] mx-auto mb-3" />
          <p className="text-[#A8A29E]">Aucune entreprise favorite pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {saved.map(c => <CompanyCard key={c.id} company={c} isFav={true} onFav={onFav} onView={onView} />)}
        </div>
      )}
      </>}
      {category === 'offers' && <>
        {offersLoading && <p className="text-sm text-[#78716C]">Chargement des offres favorites…</p>}
        {offersError && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Impossible de charger les offres : {offersError}</p>}
        {!offersLoading && !offersError && savedOffers.length === 0 && <div className="py-20 text-center"><BriefcaseBusiness size={32} className="mx-auto mb-3 text-[#EAE5E0]" /><p className="text-[#A8A29E]">Aucune offre favorite pour le moment.</p></div>}
        {!offersLoading && !offersError && savedOffers.length > 0 && <div className="grid max-w-5xl gap-4">{savedOffers.map(offer => <article key={offer.id} className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-[#1C1917]">{offer.title}</h2><p className="mt-1 text-sm font-semibold text-[#57534E]">{offer.entreprise?.nom || 'Entreprise non renseignée'}</p><p className="mt-1 flex items-center gap-1 text-xs text-[#78716C]"><MapPin size={12} /> {offer.location}</p></div><button type="button" onClick={() => void toggleOfferFavorite(offer.id)} className="rounded-lg bg-[#D9828D]/15 p-2 text-[#A12E44]" aria-label="Retirer des offres favorites"><Heart size={15} className="fill-current" /></button></div><p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[#57534E]">{offer.description}</p>{offer.source_url && <a href={offer.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#621E3E] hover:underline"><ExternalLink size={12} /> Ouvrir l’annonce</a>}</article>)}</div>}
      </>}
    </div>
  );
}
