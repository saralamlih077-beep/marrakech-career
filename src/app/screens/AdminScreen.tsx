import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, BarChart3, BriefcaseBusiness, FileCheck2, Heart, RefreshCw, UserCheck, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { PageHeader } from '../components/shared';

type AdminData = {
  users: { total: number; newLast30Days: number; profilesCompleted: number };
  activity: { favorites: number; applications: number; applicationsByStatus: Record<string, number> };
  offers: { total: number; verified: number; pending: number; closed: number };
  feedback: { total: number; averageRating: number; ratings: Array<{ rating: number; value: number }>; interpretation: string };
};

const labelForStatus: Record<string, string> = { saved: 'Sauvegardées', prepared: 'Préparées', applied: 'Envoyées', interview: 'Entretiens', accepted: 'Acceptées', rejected: 'Refusées' };
const chartColors = ['#621E3E', '#667436', '#C6C954', '#D9828D', '#64748B', '#A16207'];

export default function AdminScreen() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    const { data: result, error: invokeError } = await supabase.functions.invoke('admin-analytics');
    if (invokeError) setError('Impossible de charger les statistiques administrateur. Vérifiez que votre compte est autorisé.');
    else setData(result as AdminData);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const applicationData = useMemo(() => Object.entries(data?.activity.applicationsByStatus || {}).map(([status, value]) => ({ name: labelForStatus[status] || status, value })), [data]);

  return <div className="flex-1 overflow-auto bg-[#FBF9F7] p-8">
    <div className="flex items-start justify-between gap-4"><PageHeader title="Administration" sub="Statistiques globales, anonymisées et réservées à la plateforme." /><button onClick={() => void load()} disabled={loading} className="mt-1 flex items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white px-3 py-2 text-xs font-bold text-[#621E3E] disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Actualiser</button></div>
    {error && <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={18} className="shrink-0" />{error}</div>}
    {loading && !data && <p className="mt-10 text-sm text-[#78716C]">Chargement des statistiques…</p>}
    {data && <>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Inscriptions', data.users.total, Users], ['Nouveaux (30 jours)', data.users.newLast30Days, UserCheck], ['Profils complétés', data.users.profilesCompleted, FileCheck2], ['Candidatures', data.activity.applications, BriefcaseBusiness]].map(([label, value, Icon]) => { const ItemIcon = Icon as typeof Users; return <div key={String(label)} className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-2xl font-extrabold text-[#621E3E]">{value as number}</p><p className="mt-1 text-xs text-[#78716C]">{String(label)}</p></div><div className="rounded-xl bg-[#621E3E]/10 p-2 text-[#621E3E]"><ItemIcon size={18} /></div></div></div>; })}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-[#1C1917]">Candidatures par statut</h2><p className="mt-1 text-xs text-[#78716C]">Données globales de suivi, sans informations personnelles.</p><ResponsiveContainer width="100%" height={260}><BarChart data={applicationData} margin={{ top: 22, left: -15, right: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716C' }} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#78716C' }} /><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE5E0', fontSize: 12 }} /><Bar dataKey="value" fill="#621E3E" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></section>
        <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-[#1C1917]">Offres et engagement</h2><p className="mt-1 text-xs text-[#78716C]">État réel des offres dans la base.</p><div className="mt-6 grid grid-cols-2 gap-3"><Stat label="Offres totales" value={data.offers.total} icon={<BarChart3 size={16} />} /><Stat label="Offres validées" value={data.offers.verified} icon={<BriefcaseBusiness size={16} />} /><Stat label="En attente" value={data.offers.pending} icon={<FileCheck2 size={16} />} /><Stat label="Entreprises en favoris" value={data.activity.favorites} icon={<Heart size={16} />} /></div><div className="mt-5 h-[105px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Validées', value: data.offers.verified }, { name: 'En attente', value: data.offers.pending }, { name: 'Fermées', value: data.offers.closed }].filter((item) => item.value > 0)} dataKey="value" innerRadius={28} outerRadius={48}>{[0, 1, 2].map((index) => <Cell key={index} fill={chartColors[index + 1]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE5E0', fontSize: 12 }} /></PieChart></ResponsiveContainer></div></section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-[#1C1917]">Satisfaction des utilisateurs</h2><p className="mt-2 rounded-lg bg-[#C6C954]/15 p-3 text-xs leading-relaxed text-[#4a4d1a]"><b>Interprétation Groq :</b> {data.feedback?.interpretation || 'Analyse indisponible.'}</p><ResponsiveContainer width="100%" height={220}><BarChart data={data.feedback?.ratings || []}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="rating" tickFormatter={(value) => `${value} ★`} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#C6C954" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></section>
        <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-[#1C1917]">Indicateur de satisfaction</h2><p className="mt-2 rounded-lg bg-[#621E3E]/8 p-3 text-xs text-[#621E3E]">Moyenne calculée sur les avis réellement envoyés.</p><div className="mt-8 text-center"><p className="text-5xl font-extrabold text-[#621E3E]">{data.feedback?.averageRating || 0}<span className="text-xl">/5</span></p><p className="mt-2 text-sm text-[#78716C]">{data.feedback?.total || 0} avis collectés</p></div><ResponsiveContainer width="100%" height={115}><PieChart><Pie data={[{ name: 'Satisfaction', value: data.feedback?.averageRating || 0 }, { name: 'Reste', value: Math.max(0, 5 - (data.feedback?.averageRating || 0)) }]} dataKey="value" innerRadius={32} outerRadius={48}><Cell fill="#667436" /><Cell fill="#F1EEEB" /></Pie></PieChart></ResponsiveContainer></section>
      </div>
    </>}
  </div>;
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="rounded-xl bg-[#FBF9F7] p-3"><div className="flex items-center gap-2 text-[#667436]">{icon}<span className="text-xs font-semibold text-[#78716C]">{label}</span></div><p className="mt-2 text-xl font-extrabold text-[#1C1917]">{value}</p></div>; }
