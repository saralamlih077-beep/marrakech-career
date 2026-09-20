import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, BarChart3, BriefcaseBusiness, FileCheck2, Heart, RefreshCw, UserCheck, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { PageHeader } from '../components/shared';

type AdminData = {
  users: {
    total: number;
    newLast30Days: number;
    profilesCompleted: number;
    registeredUsers: Array<{ id: string; email: string; fullName: string; createdAt: string; emailConfirmedAt: string | null }>;
    registrationsByDay: Array<{ date: string; value: number }>;
    emailConfirmation: Array<{ name: string; value: number }>;
    profileCompletion: Array<{ name: string; value: number }>;
  };
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
    else {
      // The Edge Function can be updated independently from the front end. Keep
      // the screen usable if an older cached function response is returned.
      const analytics = result as Partial<AdminData>;
      setData({
        ...(analytics as AdminData),
        users: {
          ...(analytics.users as AdminData['users']),
          registeredUsers: analytics.users?.registeredUsers || [],
          registrationsByDay: analytics.users?.registrationsByDay || [],
          emailConfirmation: analytics.users?.emailConfirmation || [],
          profileCompletion: analytics.users?.profileCompletion || [],
        },
      });
    }
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
      <section className="mt-5 overflow-hidden rounded-2xl border border-[#EAE5E0] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-[#EAE5E0] px-5 py-4">
          <div><h2 className="text-sm font-bold text-[#1C1917]">Utilisateurs inscrits</h2><p className="mt-1 text-xs text-[#78716C]">Accès réservé aux administrateurs de Marrakech Career.</p></div>
          <span className="rounded-full bg-[#621E3E]/10 px-2.5 py-1 text-xs font-bold text-[#621E3E]">{data.users.registeredUsers.length}</span>
        </div>
        {data.users.registeredUsers.length ? <div className="max-h-80 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-[#FBF9F7] text-[#78716C]"><tr><th className="px-5 py-3 font-semibold">Utilisateur</th><th className="px-5 py-3 font-semibold">E-mail</th><th className="px-5 py-3 font-semibold">Inscription</th><th className="px-5 py-3 font-semibold">Statut</th></tr></thead><tbody>{data.users.registeredUsers.map((user) => <tr key={user.id} className="border-t border-[#F1EEEB] text-[#57534E]"><td className="px-5 py-3 font-semibold text-[#1C1917]">{user.fullName || 'Nom non renseigné'}</td><td className="px-5 py-3">{user.email}</td><td className="px-5 py-3">{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 font-semibold ${user.emailConfirmedAt ? 'bg-[#C6C954]/20 text-[#4a4d1a]' : 'bg-[#D9828D]/15 text-[#8b3140]'}`}>{user.emailConfirmedAt ? 'E-mail confirmé' : 'À confirmer'}</span></td></tr>)}</tbody></table></div> : <p className="px-5 py-8 text-sm text-[#78716C]">Aucun utilisateur inscrit pour le moment.</p>}
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm xl:col-span-2"><h2 className="text-sm font-bold text-[#1C1917]">Évolution des inscriptions</h2><p className="mt-1 text-xs text-[#78716C]">Inscriptions quotidiennes sur les 30 derniers jours.</p><ResponsiveContainer width="100%" height={220}><LineChart data={data.users.registrationsByDay} margin={{ top: 18, left: -15, right: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#78716C' }} minTickGap={22} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#78716C' }} /><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EAE5E0', fontSize: 12 }} /><Line type="monotone" dataKey="value" stroke="#621E3E" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></section>
        <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-[#1C1917]">Validation des e-mails</h2><p className="mt-1 text-xs text-[#78716C]">Part des comptes capables de recevoir les alertes.</p><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={data.users.emailConfirmation.filter((item) => item.value > 0)} dataKey="value" innerRadius={42} outerRadius={64}>{data.users.emailConfirmation.map((item, index) => <Cell key={item.name} fill={index === 0 ? '#667436' : '#D9828D'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="flex justify-center gap-4 text-[11px] text-[#78716C]">{data.users.emailConfirmation.map((item) => <span key={item.name}>{item.name}: <b className="text-[#1C1917]">{item.value}</b></span>)}</div></section>
      </div>
      <section className="mt-5 rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-[#1C1917]">Complétion des profils</h2><p className="mt-1 text-xs text-[#78716C]">Un profil est considéré complet lorsqu’il contient un objectif professionnel et des compétences.</p><ResponsiveContainer width="100%" height={190}><BarChart data={data.users.profileCompletion} margin={{ top: 18, left: -15, right: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716C' }} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#78716C' }} /><Tooltip /><Bar dataKey="value" fill="#C6C954" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></section>
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
