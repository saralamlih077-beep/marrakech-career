import { useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BriefcaseBusiness, FileCheck2, Users } from 'lucide-react';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import AdminPage from '../components/AdminPage';
import { StatKpi } from '../components/shared';
import { registrationSeries } from '../adminRegistrationSeries';

const colors = ['#621E3E', '#667436', '#C6C954', '#D9828D', '#64748B', '#A16207'];
const statusLabels: Record<string, string> = { saved: 'Brouillons', prepared: 'Préparées', applied: 'Envoyées', interview: 'Entretiens', accepted: 'Acceptées', rejected: 'Refusées' };
const fields: Record<string, string> = { full_name: 'Nom', job_title: 'Objectif', skills: 'Compétences', education: 'Formation', experience: 'Expérience' };
const chartHeight = 220;
const tick = { fontSize: 10, fill: '#78716C' };

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
    <h2 className="text-sm font-bold text-[#1C1917]">{title}</h2>
    {description && <p className="mt-1 text-xs leading-relaxed text-[#78716C]">{description}</p>}
    {children}
  </section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="flex min-h-[220px] items-center justify-center p-5 text-center text-sm leading-relaxed text-[#78716C]">{children}</p>;
}
function Donut({ points, center }: { points: Array<{ name: string; value: number }>; center?: string }) {
  const positive = points.filter(item => item.value > 0);
  return <>
    <div className="relative">
      <ResponsiveContainer width="100%" height={chartHeight}><PieChart><Pie data={positive} dataKey="value" nameKey="name" innerRadius={60} outerRadius={82} isAnimationActive={false}>
        {positive.map(item => <Cell key={item.name} fill={colors[points.indexOf(item) % colors.length]} />)}
      </Pie><Tooltip /></PieChart></ResponsiveContainer>
      {center && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-[#621E3E]">{center}</span>}
    </div>
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-[#78716C]">{points.map((point, index) => <span key={point.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{point.name} : <b>{point.value}</b></span>)}</div>
  </>;
}

export default function AdminUsersScreen({ onDirectory }: { onDirectory: () => void }) {
  const { data, loading, error, reload } = useAdminAnalytics();
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [tab, setTab] = useState<'activity' | 'profiles' | 'applications'>('activity');
  const registrations = useMemo(() => registrationSeries(data?.users.registeredUsers || [], period), [data, period]);
  const engagement = data?.engagement?.[period] || [];
  const trends = data?.applicationTrends?.[period] || [];
  const consultationPoints = [
    { name: 'Studio CV', value: engagement.reduce((sum, item) => sum + (item.cvViews || 0), 0) },
    { name: 'Page Offres', value: engagement.reduce((sum, item) => sum + (item.offerViews || 0), 0) },
  ];
  const applications = Object.entries(data?.activity.applicationsByStatus || {}).map(([status, value]) => ({ name: statusLabels[status] || status, value }));
  const quality = (data?.profileQuality || []).map(item => ({ name: fields[item.field] || item.field, rate: data?.users.total ? Math.round(item.value / data.users.total * 100) : 0 }));
  const profileRate = data?.users.total ? Math.round(data.users.profilesCompleted / data.users.total * 100) : 0;
  const trackedSince = data?.engagement?.startedAt ? new Date(data.engagement.startedAt).toLocaleDateString('fr-FR') : null;
  const tabs = [{ id: 'activity', label: 'Activité' }, { id: 'profiles', label: 'Profils et compétences' }, { id: 'applications', label: 'Candidatures' }] as const;

  return <AdminPage title="Analyse des utilisateurs" subtitle="Inscriptions, engagement, qualité des profils et parcours de candidature." loading={loading} error={error} reload={reload}>
    {data && <>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKpi icon={Users} label="Utilisateurs inscrits" value={data.users.total} accent />
        <StatKpi icon={Activity} label="Actifs suivis (30 jours)" value={data.engagement?.available ? data.engagement.activeLast30Days : '—'} />
        <StatKpi icon={FileCheck2} label="Profils complétés" value={`${profileRate} %`} />
        <StatKpi icon={BriefcaseBusiness} label="Candidatures enregistrées" value={data.activity.applications} />
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Analyses utilisateurs" className="flex flex-wrap gap-1 rounded-xl bg-[#EAE5E0] p-1">{tabs.map(item => <button key={item.id} id={`analysis-tab-${item.id}`} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === item.id ? 'bg-white text-[#621E3E] shadow-sm' : 'text-[#78716C]'}`}>{item.label}</button>)}</div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Période des analyses" value={period} onChange={event => setPeriod(event.target.value === 'week' ? 'week' : 'month')} className="rounded-xl border border-[#EAE5E0] bg-white px-3 py-2 text-xs font-semibold text-[#621E3E]"><option value="week">Semaine</option><option value="month">Mois</option></select>
          <button onClick={onDirectory} className="rounded-xl bg-[#621E3E] px-3 py-2 text-xs font-bold text-white">Voir les utilisateurs</button>
        </div>
      </div>
      <div role="tabpanel" aria-labelledby={`analysis-tab-${tab}`} className="grid gap-5 xl:grid-cols-2">
        {tab === 'activity' && <>
          <Card title="Évolution des inscriptions" description={period === 'week' ? '12 dernières semaines.' : '12 derniers mois.'}>
            <ResponsiveContainer width="100%" height={chartHeight}><LineChart data={registrations} margin={{ top: 20, left: -20, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="date" tick={tick} minTickGap={20} /><YAxis allowDecimals={false} tick={tick} /><Tooltip /><Line name="Inscriptions" type="linear" dataKey="value" stroke="#621E3E" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer>
          </Card>
          <Card title="Utilisateurs actifs : nouveaux et récurrents" description={trackedSince ? `Suivi depuis le ${trackedSince}. Nouveaux : inscrits dans la période ; récurrents : inscrits avant. Chaque compte est compté une fois par période.` : 'Le suivi commence avec les prochaines visites.'}>
            {data.engagement?.available ? <ResponsiveContainer width="100%" height={chartHeight}><AreaChart data={engagement} margin={{ top: 20, left: -20, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="date" tick={tick} minTickGap={20} /><YAxis allowDecimals={false} tick={tick} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Area name="Nouveaux actifs" type="linear" dataKey="newUsers" stackId="active" stroke="#621E3E" fill="#621E3E" fillOpacity={0.35} dot={{ r: 3 }} isAnimationActive={false} /><Area name="Récurrents actifs" type="linear" dataKey="returningUsers" stackId="active" stroke="#667436" fill="#667436" fillOpacity={0.35} dot={{ r: 3 }} isAnimationActive={false} /></AreaChart></ResponsiveContainer> : <Empty>Aucune activité suivie pour le moment.</Empty>}
          </Card>
          <Card title="Consultations du CV et des offres" description={`Ouvertures du Studio CV et de la page Offres, dans les périodes affichées.${trackedSince ? ` Suivi depuis le ${trackedSince}.` : ''}`}>
            {consultationPoints.some(item => item.value) ? <Donut points={consultationPoints} center={String(consultationPoints.reduce((sum, item) => sum + item.value, 0))} /> : <Empty>Les prochaines consultations alimenteront cet anneau.</Empty>}
          </Card>
          <Card title="Validation des e-mails"><Donut points={data.users.emailConfirmation} center={data.users.total ? `${Math.round((data.users.emailConfirmation.find(item => item.name === 'Confirmés')?.value || 0) / data.users.total * 100)} %` : '—'} /></Card>
        </>}
        {tab === 'profiles' && <>
          <Card title="Taux de complétion des profils" description="Un profil complet contient un objectif professionnel et des compétences."><Donut points={data.users.profileCompletion} center={`${profileRate} %`} /></Card>
          <Card title="Informations renseignées" description="Part des utilisateurs ayant renseigné chaque rubrique (%).">
            <ResponsiveContainer width="100%" height={chartHeight + 30}><RadarChart data={quality} outerRadius="68%"><PolarGrid /><PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Radar name="Profils renseignés (%)" dataKey="rate" stroke="#621E3E" fill="#621E3E" fillOpacity={0.25} isAnimationActive={false} /><Tooltip /></RadarChart></ResponsiveContainer>
          </Card>
          <Card title="Correspondance par compétence" description="Part des offres validées demandant une compétence déclarée par les utilisateurs, avec correspondance exacte des libellés.">
            {data.skills?.verifiedOffers && data.skills.skills.length ? <ResponsiveContainer width="100%" height={chartHeight + 30}><RadarChart data={data.skills.skills} outerRadius="68%"><PolarGrid /><PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Radar name="Offres correspondantes (%)" dataKey="rate" stroke="#667436" fill="#667436" fillOpacity={0.25} isAnimationActive={false} /><Tooltip /></RadarChart></ResponsiveContainer> : <Empty>{data.skills?.verifiedOffers ? 'Aucune compétence déclarée dans les profils pour calculer les correspondances.' : 'Aucune offre validée disponible pour calculer les correspondances.'}</Empty>}
          </Card>
          {data.feedback && <Card title="Satisfaction des utilisateurs" description={data.feedback.interpretation}>
            {data.feedback.total ? <Donut points={data.feedback.ratings.map(item => ({ name: `${item.rating} étoile${item.rating > 1 ? 's' : ''}`, value: item.value }))} center={`${data.feedback.averageRating}/5`} /> : <Empty>Aucun avis envoyé pour le moment.</Empty>}
          </Card>}
        </>}
        {tab === 'applications' && <>
          <Card title="Candidatures enregistrées dans le temps" description="Nombre de candidatures créées par période, tous statuts confondus."><ResponsiveContainer width="100%" height={chartHeight}><AreaChart data={trends} margin={{ top: 20, left: -20, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="date" tick={tick} minTickGap={20} /><YAxis allowDecimals={false} tick={tick} /><Tooltip /><Area name="Candidatures créées" type="linear" dataKey="registered" stroke="#621E3E" fill="#D9828D" fillOpacity={0.35} dot={{ r: 3 }} isAnimationActive={false} /></AreaChart></ResponsiveContainer></Card>
          <Card title="Évolution des étapes" description={data.applicationTrends?.startedAt ? `Passages de statut suivis depuis le ${new Date(data.applicationTrends.startedAt).toLocaleDateString('fr-FR')}. Les changements antérieurs ne sont pas reconstitués.` : 'Le suivi des changements commence avec les prochaines candidatures.'}>
            {data.applicationTrends?.statusTrackingAvailable ? <ResponsiveContainer width="100%" height={chartHeight}><LineChart data={trends} margin={{ top: 20, left: -20, right: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" /><XAxis dataKey="date" tick={tick} minTickGap={20} /><YAxis allowDecimals={false} tick={tick} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Line name="Envois" dataKey="sent" stroke="#621E3E" dot={{ r: 3 }} isAnimationActive={false} /><Line name="Entretiens" dataKey="interviews" stroke="#667436" dot={{ r: 3 }} isAnimationActive={false} /><Line name="Acceptations" dataKey="accepted" stroke="#C6C954" dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <Empty>Aucun changement de statut suivi pour le moment.</Empty>}
            <p className="mt-2 text-xs text-[#78716C]">Lecture par le recruteur : non mesurée.</p>
          </Card>
          <Card title="Répartition des statuts actuels">{data.activity.applications ? <Donut points={applications} center={String(data.activity.applications)} /> : <Empty>Aucune candidature enregistrée.</Empty>}</Card>
          <Card title="Parcours des candidatures" description="Nombre de candidatures actuellement dans chaque étape.">
            {data.activity.applications ? <ol className="mt-5 space-y-3">{['prepared', 'applied', 'interview', 'accepted'].map((status, index) => <li key={status} className="flex items-center gap-4 rounded-xl bg-[#FBF9F7] px-4 py-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white" style={{ backgroundColor: colors[index] }}>{data.activity.applicationsByStatus[status] || 0}</span><span className="text-sm font-semibold text-[#57534E]">{statusLabels[status]}</span></li>)}</ol> : <Empty>Aucune candidature enregistrée.</Empty>}
          </Card>
        </>}
      </div>
    </>}
  </AdminPage>;
}
