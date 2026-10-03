import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, Globe, Mail, MapPin } from 'lucide-react';
import { CompanyStatus, PageHeader, StatKpi } from '../components/shared';
import type { Company } from '../types';

const colors = ['#621E3E', '#667436', '#C6C954', '#D9828D', '#64748B', '#A16207'];
const missingValues = new Set(['', '-', 'n/a', 'na', 'nan', 'null', 'none', 'non disponible', 'non renseigné']);
const hasValue = (value: string | null | undefined) => !missingValues.has(value?.trim().toLowerCase() ?? '');
const hasLocation = (company: Company) => company.latitude !== null && company.longitude !== null
  && Number.isFinite(company.latitude) && Number.isFinite(company.longitude)
  && Math.abs(company.latitude) <= 90 && Math.abs(company.longitude) <= 180;

function distribution(companies: Company[], field: 'domaine' | 'categorie') {
  return Object.entries(companies.reduce<Record<string, number>>((counts, company) => {
    const label = company[field]?.trim() || 'Non renseigné';
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export default function AdminDataScreen({ companies, loading, error }: {
  companies: Company[]; loading: boolean; error: string | null;
}) {
  const domains = distribution(companies, 'domaine');
  const allCategories = distribution(companies, 'categorie');
  const categories = allCategories.slice(0, 5);
  if (allCategories.length > 5) categories.push({ name: 'Autres catégories', value: allCategories.slice(5).reduce((sum, item) => sum + item.value, 0) });
  const emailCount = companies.filter(company => hasValue(company.email)).length;
  const websiteCount = companies.filter(company => hasValue(company.site_web)).length;
  const locationCount = companies.filter(hasLocation).length;
  const coverage = [
    { name: 'E-mail', value: emailCount },
    { name: 'Téléphone', value: companies.filter(company => hasValue(company.telephone)).length },
    { name: 'Site web', value: websiteCount },
    { name: 'Adresse', value: companies.filter(company => hasValue(company.adresse)).length },
    { name: 'Coordonnées GPS', value: locationCount },
  ];
  const ratedCompanies = companies.filter(company => company.note !== null && Number.isFinite(company.note));
  const averageRating = ratedCompanies.length
    ? (ratedCompanies.reduce((sum, company) => sum + (company.note ?? 0), 0) / ratedCompanies.length).toFixed(1)
    : null;

  return (
    <div className="flex-1 overflow-auto bg-[#FBF9F7] p-5 md:p-8">
      <PageHeader title="Analyse des données" sub="Vue globale des entreprises et des informations disponibles dans la base." />
      <CompanyStatus loading={loading} error={error} />
      {!loading && !error && (companies.length ? <>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatKpi icon={Building2} label="Entreprises chargées" value={companies.length} accent />
          <StatKpi icon={Mail} label="Avec un e-mail" value={emailCount} />
          <StatKpi icon={Globe} label="Avec un site web" value={websiteCount} />
          <StatKpi icon={MapPin} label="Géolocalisées" value={locationCount} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1C1917]">Entreprises par domaine</h2>
            <p className="mt-1 text-xs text-[#78716C]">{domains.length} domaines · les 10 plus représentés.</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={domains.slice(0, 10)} layout="vertical" margin={{ top: 15, left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip /><Bar name="Entreprises" dataKey="value" fill="#621E3E" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1C1917]">Disponibilité des coordonnées</h2>
            <p className="mt-1 text-xs text-[#78716C]">Nombre d’entreprises avec chaque information renseignée.</p>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={coverage} layout="vertical" margin={{ top: 15, left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1EEEB" horizontal={false} />
                <XAxis type="number" allowDecimals={false} domain={[0, companies.length]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip /><Bar name="Entreprises" dataKey="value" fill="#667436" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-3 rounded-xl bg-[#FBF9F7] p-3 text-xs text-[#57534E]">
              {Math.round(emailCount / companies.length * 100)} % des entreprises disposent d’un e-mail renseigné.
            </p>
          </section>

          <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1C1917]">Répartition par catégorie</h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                {categories.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#78716C]">
              {categories.map((item, index) => <span key={item.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                {item.name} ({item.value})
              </span>)}
            </div>
          </section>

          <section className="rounded-2xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1C1917]">Qualité des informations</h2>
            <p className="mt-1 text-xs text-[#78716C]">Les champs renseignés restent à vérifier avant utilisation.</p>
            <div className="mt-5 space-y-4">
              {coverage.map(item => <div key={item.name}>
                <div className="mb-1.5 flex justify-between text-xs text-[#57534E]">
                  <span>{item.name}</span><span>{item.value}/{companies.length} · {Math.round(item.value / companies.length * 100)} %</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#F1EEEB]">
                  <div className="h-full rounded-full bg-[#C6C954]" style={{ width: `${item.value / companies.length * 100}%` }} />
                </div>
              </div>)}
            </div>
            <p className="mt-6 text-xs text-[#78716C]">Note moyenne : <b className="text-[#621E3E]">{averageRating ? `${averageRating}/5` : 'Non disponible'}</b> · {ratedCompanies.length} entreprises notées.</p>
          </section>
        </div>
      </> : <p className="rounded-2xl border border-[#EAE5E0] bg-white p-8 text-sm text-[#78716C]">Aucune entreprise disponible pour l’analyse.</p>)}
    </div>
  );
}
