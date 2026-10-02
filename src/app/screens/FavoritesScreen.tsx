import { Heart } from 'lucide-react';
import { CompanyCard, CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';

export default function FavoritesScreen({ companies, loading, error, favs, onFav, onView }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void }) {
  const saved = companies.filter(c => favs.has(c.id));

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <PageHeader title="Favorite Companies" sub={`${saved.length} saved companies`} />
      <CompanyStatus loading={loading} error={error} />
      {saved.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={32} className="text-[#EAE5E0] mx-auto mb-3" />
          <p className="text-[#A8A29E]">No saved companies yet. Click the heart icon on a company to save it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {saved.map(c => <CompanyCard key={c.id} company={c} isFav={true} onFav={onFav} onView={onView} />)}
        </div>
      )}
    </div>
  );
}
