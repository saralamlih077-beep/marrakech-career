import { AlertTriangle, ArrowLeft, Check, Eye, FileText, Heart, MapPin, Send } from 'lucide-react';
import { DOMAIN_COLORS } from '../constants';
import type { Company } from '../types';
import { companyAddress, companyMatch, companySkills, matchColor } from '../utils';

export function MatchBadge({ pct }: { pct: number }) {
  const c = matchColor(pct);
  return (
    <span className="text-sm font-bold" style={{ color: c }}>{pct}%</span>
  );
}

export function SectorPill({ domaine, sousDomaine }: { domaine: string; sousDomaine?: string | null }) {
  const c = DOMAIN_COLORS[domaine] || '#621E3E';
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: c }}>
      {domaine}{sousDomaine ? ` · ${sousDomaine}` : ''}
    </span>
  );
}

export function CompanyStatus({ loading, error }: { loading: boolean; error: string | null }) {
  if (!loading && !error) return null;
  return (
    <div className="py-6 text-center text-sm text-[#78716C]">
      {loading ? 'Chargement des entreprises...' : `Impossible de charger les entreprises : ${error}`}
    </div>
  );
}

export function SkillTag({ label, missing = false }: { label: string; missing?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${missing ? 'bg-[#FFEC8E]/40 text-[#92680A] border border-[#C6C954]/30' : 'bg-[#FBF9F7] border border-[#EAE5E0] text-[#57534E]'}`}>
      {missing ? <AlertTriangle size={10} /> : <Check size={10} className="text-[#667436]" />}
      {label}
    </span>
  );
}

export function CompanyCard({ company, isFav, onFav, onView, onApply, onTailoredCv }: {
  company: Company; isFav: boolean;
  onFav: (id: number) => void; onView: (c: Company) => void; onApply?: (c: Company) => void; onTailoredCv?: (c: Company) => void;
}) {
  const initials = company.nom.split(' ').slice(0, 2).map(w => w[0]).join('');
  const sc = DOMAIN_COLORS[company.domaine || ''] || '#621E3E';
  const skills = companySkills(company);
  const match = companyMatch(company);
  return (
    <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: sc }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#1C1917] truncate">{company.nom}</h3>
          <SectorPill domaine={company.domaine || 'Domaine non renseigné'} sousDomaine={company.sous_domaine} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MatchBadge pct={match} />
          <button onClick={() => onFav(company.id)}>
            <Heart size={15} className={isFav ? 'fill-[#D9828D] text-[#D9828D]' : 'text-[#C8C2BC] hover:text-[#D9828D]'} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-[#78716C]">
        <MapPin size={11} />{companyAddress(company)}
      </div>
      <div className="flex flex-wrap gap-1">
        {skills.slice(0, 3).map(sk => (
          <span key={sk} className="text-[10px] px-2 py-0.5 rounded-full bg-[#FBF9F7] border border-[#EAE5E0] text-[#57534E]">{sk}</span>
        ))}
        {skills.length > 3 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FBF9F7] border border-[#EAE5E0] text-[#78716C]">+{skills.length - 3}</span>}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onView(company)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border border-[#EAE5E0] text-[#621E3E] hover:bg-[#621E3E]/5 transition-colors">
          <Eye size={11} /> View
        </button>
        {onTailoredCv && <button onClick={() => onTailoredCv(company)} aria-label={`Générer un CV avec l’IA pour ${company.nom}`} title={`Générer un CV avec l’IA pour ${company.nom}`} className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-semibold border border-[#C6C954]/50 bg-[#C6C954]/15 text-[#4a4d1a] hover:bg-[#C6C954]/25 transition-colors whitespace-nowrap"><FileText size={11} className="shrink-0" /> CV IA</button>}
        <button onClick={() => (onApply || onView)(company)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-[#621E3E] text-white hover:bg-[#4e1830] transition-colors">
          <Send size={11} /> Apply
        </button>
      </div>
    </div>
  );
}

export function StatKpi({ icon: Icon, label, value, accent = false }: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string; value: string | number; accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${accent ? 'bg-[#621E3E]/10' : 'bg-[#FBF9F7]'}`}>
        <Icon size={20} style={{ color: accent ? '#621E3E' : '#78716C' }} />
      </div>
      <div>
        <p className="text-xs text-[#78716C] font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[#1C1917]">{value}</p>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, back, onBack }: { title: string; sub?: string; back?: boolean; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {back && (
        <button onClick={onBack} aria-label="Retour" className="p-1.5 rounded-lg hover:bg-[#EAE5E0] transition-colors">
          <ArrowLeft size={18} className="text-[#78716C]" />
        </button>
      )}
      <div>
        <h1 className="text-xl font-bold text-[#1C1917]">{title}</h1>
        {sub && <p className="text-sm text-[#78716C] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
