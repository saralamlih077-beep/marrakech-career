import { BarChart3, Bookmark, Building2, MessageCircle, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useProfile } from '../../hooks/useProfile';
import { CompanyCard, CompanyStatus, StatKpi } from '../components/shared';
import type { Company, NavPage } from '../types';
import { recommendationScore } from '../utils';
import { useLanguage } from '../i18n';

export default function DashboardScreen({ companies, loading, error, favs, onFav, onView, onNavigate, onApply }: {
  companies: Company[]; loading: boolean; error: string | null;
  favs: Set<number>; onFav: (id: number) => void;
  onView: (c: Company) => void; onNavigate: (p: NavPage) => void; onApply: (c: Company) => void;
}) {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackState, setFeedbackState] = useState('');
  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'User';
  const recommended = [...companies].sort((a, b) => recommendationScore(b, profile) - recommendationScore(a, profile)).slice(0, 4);
  const sectorChartData = useMemo(() => {
    const counts = new Map<string, number>();
    companies.forEach((company) => {
      const domain = company.domaine?.trim() || 'Non renseigné';
      counts.set(domain, (counts.get(domain) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([s, n]) => ({ s, n }))
      .sort((a, b) => b.n - a.n || a.s.localeCompare(b.s, 'fr'));
  }, [companies]);
  const submitFeedback = async () => {
    if (!rating) return setFeedbackState('Choisissez une note entre 1 et 5 étoiles.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setFeedbackState('Veuillez vous reconnecter.');
    const { error } = await supabase.from('user_feedback').upsert({ user_id: user.id, rating, comment: comment.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setFeedbackState(error ? `Impossible d’enregistrer : ${error.message}` : 'Merci, votre avis a été enregistré.');
    if (!error) { setComment(''); setTimeout(() => setFeedbackOpen(false), 900); }
  };
  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-extrabold text-[#1C1917]">{t('hello')}, {firstName}</h1>
        <p className="text-[#78716C] mt-1">{t('nextOpportunity')}</p>
        </div>
        <button onClick={() => { setFeedbackState(''); setFeedbackOpen(true); }} className="flex items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white px-3 py-2 text-xs font-bold text-[#621E3E] shadow-sm hover:bg-[#FBF9F7]"><MessageCircle size={15} /> Donner mon avis</button>
      </div>
      {feedbackOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-[#1C1917]">Votre avis compte</h2><p className="mt-1 text-sm text-[#78716C]">Êtes-vous satisfait(e) de Marrakech Career ?</p></div><button onClick={() => setFeedbackOpen(false)} className="text-[#78716C]">×</button></div><div className="mt-5 flex gap-2">{[1,2,3,4,5].map(value => <button key={value} onClick={() => setRating(value)} aria-label={`${value} étoiles`}><Star size={30} className={value <= rating ? 'fill-[#C6C954] text-[#667436]' : 'text-[#D6D3D1]'} /></button>)}</div><textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Votre suggestion ou remarque (facultatif)" className="mt-5 min-h-28 w-full rounded-xl border border-[#EAE5E0] p-3 text-sm outline-none focus:border-[#667436]" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setFeedbackOpen(false)} className="rounded-lg px-3 py-2 text-sm text-[#78716C]">Annuler</button><button onClick={() => void submitFeedback()} className="rounded-lg bg-[#621E3E] px-4 py-2 text-sm font-bold text-white">Envoyer</button></div>{feedbackState && <p className="mt-3 text-xs text-[#667436]">{feedbackState}</p>}</div></div>}

      <div className="dashboard-stats grid grid-cols-3 gap-4 mb-7">
        <StatKpi icon={Building2} label={t('companiesCount')} value={companies.length} accent /><StatKpi icon={BarChart3} label={t('domains')} value={new Set(companies.map(c => c.domaine).filter(Boolean)).size} /><StatKpi icon={Bookmark} label={t('saved')} value={favs.size} />
      </div>

      <div className="mb-7">
        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-4">{t('companiesByDomain')}</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, sectorChartData.length * 34)}>
            <BarChart layout="vertical" data={sectorChartData} margin={{ top: 0, right: 38, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#78716C' }} allowDecimals={false} />
              <YAxis type="category" dataKey="s" width={175} tick={{ fontSize: 11, fill: '#57534E' }} tickFormatter={(value) => value.length > 26 ? `${value.slice(0, 26)}…` : value} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
              <Bar dataKey="n" fill="#621E3E" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="n" position="right" fill="#57534E" fontSize={11} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1C1917]">{t('recommended')}</h3>
          <button onClick={() => onNavigate('companies')} className="text-xs text-[#621E3E] font-semibold hover:underline">{t('viewAll')}</button>
        </div>
        <CompanyStatus loading={loading} error={error} />
        <div className="grid grid-cols-4 gap-4">
          {recommended.map(c => (
            <CompanyCard key={c.id} company={c} isFav={favs.has(c.id)} onFav={onFav} onView={onView} onApply={onApply} />
          ))}
        </div>
      </div>
    </div>
  );
}
