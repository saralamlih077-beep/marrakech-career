import { BarChart3, Bookmark, Building2, ChevronRight, ClipboardList, MessageCircle, Sparkles, Star } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCandidatures } from '../../hooks/useCandidatures';
import { useProfile } from '../../hooks/useProfile';
import { CompanyCard, CompanyStatus, StatKpi } from '../components/shared';
import { opportunityData, sectorChartData } from '../constants';
import type { Company, NavPage } from '../types';
import { recommendationScore } from '../utils';
import { useLanguage } from '../i18n';

export default function DashboardScreen({ companies, loading, error, favs, onFav, onView, onNavigate, onApply, onTailoredCv }: {
  companies: Company[]; loading: boolean; error: string | null;
  favs: Set<number>; onFav: (id: number) => void;
  onView: (c: Company) => void; onNavigate: (p: NavPage) => void; onApply: (c: Company) => void; onTailoredCv: (c: Company) => void;
}) {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const { data: candidatures } = useCandidatures();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackState, setFeedbackState] = useState('');
  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'User';
  const recommended = [...companies].sort((a, b) => recommendationScore(b, profile) - recommendationScore(a, profile)).slice(0, 4);
  const averageMatch = recommended.length === 0 ? 0 : Math.round(recommended.reduce((sum, company) => sum + recommendationScore(company, profile), 0) / recommended.length);
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

      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatKpi icon={Building2} label={t('companiesCount')} value={companies.length} accent /><StatKpi icon={BarChart3} label={t('domains')} value={new Set(companies.map(c => c.domaine).filter(Boolean)).size} /><StatKpi icon={Bookmark} label={t('saved')} value={favs.size} /><StatKpi icon={ClipboardList} label={t('activeApplications')} value={candidatures.filter(item => !['accepted', 'rejected'].includes(item.statut.toLowerCase())).length} accent />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-7">
        <div className="col-span-2 bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-4">{t('companiesByDomain')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sectorChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" />
              <XAxis dataKey="s" tick={{ fontSize: 10, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
              <Bar dataKey="n" fill="#621E3E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-4">{t('opportunities')}</h3>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={opportunityData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" paddingAngle={3}>
                {opportunityData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {opportunityData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-[#78716C]">{d.name} <span className="font-semibold text-[#1C1917]">{d.value}%</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#C6C954]/40 shadow-sm p-5 mb-7 flex items-center gap-5" style={{ background: 'linear-gradient(135deg, #fff 70%, #FFEC8E15)' }}>
        <div className="w-14 h-14 rounded-2xl bg-[#C6C954]/20 flex items-center justify-center shrink-0">
          <Sparkles size={26} className="text-[#667436]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-[#1C1917]">{t('profileMatch')}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#C6C954]/25 text-[#4a4d1a] font-semibold border border-[#C6C954]/40">AI Powered</span>
          </div>
          <p className="text-[#78716C] text-sm">Votre profil correspond à <strong className="text-[#667436]">{averageMatch}%</strong> des entreprises chargées. Les recommandations utilisent vos informations de profil.</p>
        </div>
        <button onClick={() => onNavigate('matching')} className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#667436] text-white rounded-xl text-sm font-semibold hover:bg-[#52592b] transition-colors">
          {t('viewMatches')} <ChevronRight size={14} />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1C1917]">{t('recommended')}</h3>
          <button onClick={() => onNavigate('companies')} className="text-xs text-[#621E3E] font-semibold hover:underline">{t('viewAll')}</button>
        </div>
        <CompanyStatus loading={loading} error={error} />
        <div className="grid grid-cols-4 gap-4">
          {recommended.map(c => (
            <CompanyCard key={c.id} company={c} isFav={favs.has(c.id)} onFav={onFav} onView={onView} onApply={onApply} onTailoredCv={onTailoredCv} />
          ))}
        </div>
      </div>
    </div>
  );
}
