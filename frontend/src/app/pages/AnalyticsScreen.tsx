import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCandidatures } from '../../hooks/useCandidatures';
import { useFavorites } from '../../hooks/useFavorites';
import { useProfile } from '../../hooks/useProfile';
import { CompanyStatus, PageHeader } from '../components/shared';
import type { Company } from '../types';
import { recommendationScore } from '../utils';

export default function AnalyticsScreen({ companies }: { companies: Company[] }) {
  const { data: candidatures, loading: applicationsLoading, error: applicationsError } = useCandidatures();
  const { favorites } = useFavorites();
  const { profile } = useProfile();
  const domainCounts = Object.entries(companies.reduce<Record<string, number>>((counts, company) => {
    const domain = company.domaine || 'Domaine non renseigné';
    counts[domain] = (counts[domain] || 0) + 1;
    return counts;
  }, {})).map(([s, n]) => ({ s, n })).sort((a, b) => b.n - a.n).slice(0, 8);
  const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const companyTexts = companies.map(company => normalize(`${company.nom} ${company.domaine ?? ''} ${company.sous_domaine ?? ''} ${company.categorie ?? ''}`));
  const profileSkills = [...new Set(profile.skills.split(',').map(skill => skill.trim()).filter(Boolean))]
    .map((skill) => ({
      s: skill,
      v: companies.length ? Math.round(companyTexts.filter(text => text.includes(normalize(skill))).length / companies.length * 100) : 0,
    }))
    .sort((first, second) => second.v - first.v)
    .slice(0, 8);
  const applicationTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const count = candidatures.filter((candidature) => {
      const sourceDate = new Date(candidature.date_postulee || candidature.created_at);
      return !Number.isNaN(sourceDate.getTime()) && `${sourceDate.getFullYear()}-${sourceDate.getMonth()}` === monthKey;
    }).length;
    return { m: date.toLocaleDateString('fr-FR', { month: 'short' }), n: count };
  });
  const matchBuckets = [
    { r: '0-39%', n: 0 }, { r: '40-59%', n: 0 }, { r: '60-79%', n: 0 }, { r: '80-100%', n: 0 },
  ];
  const hasProfileForMatching = Boolean(profile.job_title.trim() || profile.skills.trim() || profile.education.trim() || profile.experience.trim());
  companies.forEach(company => {
    const score = recommendationScore(company, profile);
    if (score < 40) matchBuckets[0].n += 1;
    else if (score < 60) matchBuckets[1].n += 1;
    else if (score < 80) matchBuckets[2].n += 1;
    else matchBuckets[3].n += 1;
  });
  const categoryCounts = Object.entries(companies.reduce<Record<string, number>>((counts, company) => {
    const category = company.categorie || 'Catégorie non renseignée';
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {})).map(([name, value], index) => ({ name, value, color: ['#621E3E', '#667436', '#C6C954', '#D9828D'][index % 4] })).sort((a, b) => b.value - a.value).slice(0, 6);
  const activeApplications = candidatures.filter(item => ['prepared', 'applied', 'interview'].includes(item.statut)).length;
  const followedApplications = candidatures.filter(item => ['interview', 'accepted', 'rejected'].includes(item.statut)).length;
  const statusLabels: Record<string, string> = { saved: 'Brouillon', prepared: 'Préparée', applied: 'Envoyée', interview: 'Entretien', accepted: 'Acceptée', rejected: 'Refusée' };
  const statusColors: Record<string, string> = { saved: '#A8A29E', prepared: '#C6C954', applied: '#667436', interview: '#621E3E', accepted: '#3B8B5B', rejected: '#D9828D' };
  const applicationPipeline = Object.keys(statusLabels).map((status) => ({
    name: statusLabels[status],
    value: candidatures.filter((item) => item.statut.toLowerCase() === status).length,
    color: statusColors[status],
  })).filter((item) => item.value > 0);
  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <PageHeader title="Career Analytics" sub="Data insights for your job search in Marrakech" />
      {applicationsLoading && <CompanyStatus loading error={null} />}
      {applicationsError && <CompanyStatus loading={false} error={applicationsError} />}

      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          ['Entreprises favorites', favorites.size],
          ['Candidatures enregistrées', candidatures.length],
          ['Candidatures actives', activeApplications],
          ['Avec un suivi', followedApplications],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#EAE5E0] bg-white p-4 shadow-sm"><p className="text-2xl font-extrabold text-[#621E3E]">{value}</p><p className="mt-1 text-xs text-[#78716C]">{label}</p></div>)}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-1">Entreprises par domaine</h3>
          <p className="text-xs text-[#78716C] mb-3">Données de la base d’entreprises disponible.</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={domainCounts} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#78716C' }} />
              <YAxis type="category" dataKey="s" tick={{ fontSize: 10, fill: '#78716C' }} width={70} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
              <Bar dataKey="n" fill="#621E3E" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-1">Présence de vos compétences</h3>
          <p className="text-xs text-[#78716C] mb-3">Pourcentage d’entreprises dont les informations contiennent chaque compétence de votre profil.</p>
          {profileSkills.length === 0 ? <p className="pt-14 text-center text-sm text-[#78716C]">Ajoutez vos compétences dans votre profil pour obtenir cette analyse.</p> :
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={profileSkills} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" />
              <XAxis dataKey="s" tick={{ fontSize: 10, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 10, fill: '#78716C' }} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
              <Bar dataKey="v" fill="#667436" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          }
        </div>

        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-1">Candidatures sur 6 mois</h3>
          <p className="text-xs text-[#78716C] mb-3">Basé sur les candidatures que vous avez enregistrées.</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={applicationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" />
              <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
              <Line type="monotone" dataKey="n" stroke="#621E3E" strokeWidth={2} dot={{ fill: '#621E3E', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1C1917] mb-1">Distribution des compatibilités</h3>
          <p className="text-xs text-[#78716C] mb-3">Calculée depuis votre profil et les informations de chaque entreprise.</p>
          {!hasProfileForMatching ? <p className="pt-10 text-center text-sm text-[#78716C]">Complétez votre profil pour calculer les compatibilités.</p> :
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={matchBuckets} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" />
              <XAxis dataKey="r" tick={{ fontSize: 9, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 10, fill: '#78716C' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
              <Bar dataKey="n" fill="#C6C954" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          }
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#1C1917] mb-1">Répartition des catégories</h3>
        <p className="text-xs text-[#78716C] mb-3">Nombre réel d’entreprises par catégorie dans la base.</p>
        <div className="flex items-center gap-10">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie data={categoryCounts} cx="50%" cy="50%" innerRadius={48} outerRadius={80} dataKey="value" paddingAngle={3}>
                {categoryCounts.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} entreprise${v > 1 ? 's' : ''}`} contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {categoryCounts.map(({ name, value, color }) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm text-[#78716C]">{name}</span>
                <span className="text-sm font-bold text-[#1C1917]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div className="rounded-xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-[#1C1917]">Pipeline des candidatures</h3>
          <p className="mb-3 text-xs text-[#78716C]">Répartition réelle selon le statut que vous suivez.</p>
          {applicationPipeline.length === 0 ? <p className="py-16 text-center text-sm text-[#78716C]">Aucune candidature à analyser pour le moment.</p> :
          <ResponsiveContainer width="100%" height={210}><BarChart data={applicationPipeline}><CartesianGrid strokeDasharray="3 3" stroke="#F5F1ED" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716C' }} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#78716C' }} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #EAE5E0', fontSize: 12 }} /> <Bar dataKey="value" radius={[5, 5, 0, 0]}>{applicationPipeline.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>}
        </div>
        <div className="rounded-xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-bold text-[#1C1917]">Taux de suivi</h3>
          <p className="mb-4 text-xs text-[#78716C]">Part des candidatures ayant reçu une décision ou un entretien.</p>
          <p className="text-4xl font-extrabold text-[#621E3E]">{candidatures.length ? Math.round(followedApplications / candidatures.length * 100) : 0}%</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#F5F1ED]"><div className="h-full rounded-full bg-[#667436]" style={{ width: `${candidatures.length ? Math.round(followedApplications / candidatures.length * 100) : 0}%` }} /></div>
          <p className="mt-3 text-sm text-[#57534E]"><b>{followedApplications}</b> sur <b>{candidatures.length}</b> candidatures ont un suivi.</p>
        </div>
      </div>
    </div>
  );
}
