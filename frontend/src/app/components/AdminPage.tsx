import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { PageHeader } from './shared';

export default function AdminPage({ title, subtitle, loading, error, reload, children }: {
  title: string; subtitle: string; loading: boolean; error: string; reload: () => void; children: ReactNode;
}) {
  return <div className="flex-1 overflow-auto bg-[#FBF9F7] p-5 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader title={title} sub={subtitle} />
      <button onClick={reload} disabled={loading} className="flex items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white px-3 py-2 text-xs font-bold text-[#621E3E] disabled:opacity-50">
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Actualiser
      </button>
    </div>
    {error && <p role="alert" className="mb-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={18} className="shrink-0" />{error}</p>}
    {loading && <p role="status" className="mb-5 text-sm text-[#78716C]">Chargement des données…</p>}
    {children}
  </div>;
}
