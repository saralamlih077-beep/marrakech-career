import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import AdminPage from '../components/AdminPage';
import { userDirectoryCsv } from '../adminUserExport';

export default function AdminUserDirectoryScreen() {
  const { data, loading, error, reload } = useAdminAnalytics();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const users = (data?.users.registeredUsers || []).filter(user =>
    `${user.fullName} ${user.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(users.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  useEffect(() => setPage(0), [query]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([userDirectoryCsv(users)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `utilisateurs-marrakech-career-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <AdminPage title="Utilisateurs" subtitle="Comptes inscrits et candidatures enregistrées dans Marrakech Career." loading={loading} error={error} reload={reload}>
    {data && <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <label className="flex w-full items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white px-3 sm:max-w-sm">
          <Search size={16} className="text-[#78716C]" />
          <input aria-label="Rechercher un utilisateur" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher par nom ou e-mail" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
        </label>
        <button onClick={download} disabled={!users.length || loading} className="flex items-center gap-2 rounded-xl bg-[#621E3E] px-4 py-3 text-xs font-bold text-white disabled:opacity-50"><Download size={15} />Exporter en CSV</button>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[#EAE5E0] bg-white shadow-sm">
        <div className="border-b border-[#EAE5E0] px-5 py-4">
          <h2 className="text-sm font-bold text-[#1C1917]">{users.length} utilisateur{users.length > 1 ? 's' : ''}{query.trim() ? ` sur ${data.users.total}` : ''}</h2>
          <p className="mt-1 text-xs text-[#78716C]">Enregistrées : tous les statuts, y compris les brouillons. Envoyées : envoi, entretien, acceptation ou refus.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="bg-[#FBF9F7] text-[#78716C]"><tr>
              {['Nom', 'E-mail', 'Inscription', 'Enregistrées', 'Envoyées', 'Statut e-mail'].map(label => <th key={label} scope="col" className="px-5 py-3 font-semibold">{label}</th>)}
            </tr></thead>
            <tbody>{users.slice(currentPage * 25, (currentPage + 1) * 25).map(user => <tr key={user.id} className="border-t border-[#F1EEEB] text-[#57534E]">
              <td className="px-5 py-4 font-semibold text-[#1C1917]">{user.fullName || 'Nom non renseigné'}</td>
              <td className="px-5 py-4">{user.email || 'E-mail non renseigné'}</td>
              <td className="px-5 py-4">{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
              <td className="px-5 py-4 font-bold text-[#621E3E]">{user.applicationCount}</td>
              <td className="px-5 py-4 font-bold text-[#667436]">{user.sentApplicationCount}</td>
              <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-2 py-1 font-semibold ${user.emailConfirmedAt ? 'bg-[#C6C954]/20 text-[#4a4d1a]' : 'bg-[#D9828D]/15 text-[#8b3140]'}`}>{user.emailConfirmedAt ? 'Confirmé' : 'À confirmer'}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!users.length && <p className="p-8 text-sm text-[#78716C]">{query.trim() ? 'Aucun utilisateur ne correspond à cette recherche.' : 'Aucun utilisateur inscrit pour le moment.'}</p>}
        {pageCount > 1 && <div className="flex items-center justify-between border-t border-[#EAE5E0] px-5 py-4 text-xs">
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="font-semibold text-[#621E3E] disabled:opacity-40">Précédent</button>
          <span>Page {currentPage + 1} sur {pageCount}</span>
          <button disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className="font-semibold text-[#621E3E] disabled:opacity-40">Suivant</button>
        </div>}
      </section>
    </>}
  </AdminPage>;
}
