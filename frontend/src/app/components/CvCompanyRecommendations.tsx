import { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import type { Company } from '../types';
import { recommendCompaniesForCv } from '../cvCompanyRecommendations';
import { CompanyCard, CompanyStatus, SkillTag } from './shared';

export default function CvCompanyRecommendations({ companies, loading, error, cv, favs, onFav, onView, onApply, onTailoredCv }: {
  companies: Company[]; loading: boolean; error: string | null;
  cv: { text: string; skills: string[] } | null;
  favs: Set<number>; onFav: (id: number) => void; onView: (company: Company) => void;
  onApply: (company: Company) => void; onTailoredCv: (company: Company) => void;
}) {
  const recommendations = useMemo(() => cv ? recommendCompaniesForCv(companies, cv.text, cv.skills) : [], [companies, cv]);
  return (
    <section aria-labelledby="cv-company-recommendations" className="rounded-xl border border-[#EAE5E0] bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Building2 size={16} className="shrink-0 text-[#621E3E]" />
        <h3 id="cv-company-recommendations" className="text-sm font-bold text-[#1C1917]">Entreprises recommandées pour votre CV</h3>
      </div>
      {!cv ? <p className="text-sm text-[#78716C]">Les entreprises adaptées à votre CV apparaîtront après l’analyse.</p> : <>
        <p className="mb-4 text-xs leading-relaxed text-[#78716C]">Suggestions parmi les entreprises de Marrakech Career, selon les compétences de ce CV et les activités des entreprises.</p>
        <CompanyStatus loading={loading} error={error} />
        {!loading && !error && recommendations.length === 0 && <p className="rounded-xl bg-[#FBF9F7] p-4 text-sm text-[#57534E]">Aucune correspondance suffisamment précise n’a été trouvée pour ce CV dans les entreprises disponibles.</p>}
        {!loading && !error && <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {recommendations.map(({ company, sectors, evidence, sharedSkills }) => (
            <div key={company.id} className="min-w-0 space-y-2">
              <div className="rounded-xl bg-[#621E3E]/5 p-3">
                <p className="text-xs font-semibold text-[#621E3E]">{sharedSkills.length ? 'Compétences communes' : `Secteur compatible : ${sectors.join(' · ')}`}</p>
                <p className="mb-2 mt-1 text-[11px] text-[#78716C]">Relevé dans votre CV :</p>
                <div className="flex flex-wrap gap-1.5">{evidence.map(skill => <SkillTag key={skill} label={skill} />)}</div>
              </div>
              <CompanyCard company={company} isFav={favs.has(company.id)} onFav={onFav} onView={onView} onApply={onApply} onTailoredCv={onTailoredCv} />
            </div>
          ))}
        </div>}
      </>}
    </section>
  );
}
