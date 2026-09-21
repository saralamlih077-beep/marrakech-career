import {
  LayoutDashboard, Building2, Map, Sparkles, MessageSquare,
  FileText, ClipboardList, Heart, BarChart3, User,
  Settings as Gear, MapPin, ShieldCheck, BriefcaseBusiness,
} from 'lucide-react';
import type { NavPage } from '../types';
import { userInitials } from '../utils';
import { useLanguage } from '../i18n';

export default function Sidebar({ active, onNavigate, userName, userEmail, isAdmin }: {
  active: NavPage; onNavigate: (p: NavPage) => void; userName: string; userEmail: string; isAdmin: boolean;
}) {
  const { t } = useLanguage();
  const primaryNav: Array<{ id: NavPage; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard }, { id: 'companies', label: t('companies'), icon: Building2 }, { id: 'map', label: t('map'), icon: Map }, { id: 'matching', label: t('matching'), icon: Sparkles }, { id: 'opportunities', label: 'Offres', icon: BriefcaseBusiness }, { id: 'assistant', label: t('assistant'), icon: MessageSquare }, { id: 'cv-studio', label: t('cvStudio'), icon: FileText }, { id: 'applications', label: t('applications'), icon: ClipboardList }, { id: 'favorites', label: t('favorites'), icon: Heart }, { id: 'analytics', label: t('analytics'), icon: BarChart3 },
  ];
  const bottomNav: Array<{ id: NavPage; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    ...(isAdmin ? [{ id: 'admin' as NavPage, label: t('admin'), icon: ShieldCheck }] : []), { id: 'profile', label: t('profile'), icon: User }, { id: 'settings', label: t('settings'), icon: Gear },
  ];

  const isActive = (id: NavPage) =>
    id === active ||
    (id === 'companies' && active === 'company-detail') ||
    (id === 'cv-studio' && active === 'cv-analyzer') ||
    (id === 'applications' && (active === 'campaign' || active === 'automation'));

  return (
    <div className="w-52 shrink-0 bg-[#621E3E] flex flex-col h-full max-md:h-auto max-md:w-full">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10 max-md:px-4 max-md:py-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <MapPin size={18} className="text-[#C6C954]" />
        </div>
        <div>
          <p className="text-white text-xs font-extrabold leading-tight">Marrakech</p>
          <p className="text-[#C6C954] text-[9px] font-extrabold tracking-[0.25em]">CAREER</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto max-md:flex max-md:gap-1 max-md:space-y-0 max-md:overflow-x-auto max-md:py-2">
        {primaryNav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap max-md:px-3 max-md:py-2 ${isActive(id) ? 'bg-white/15 text-white border-l-2 border-[#C6C954]' : 'text-white/55 hover:text-white/85 hover:bg-white/8'}`}
          >
            <Icon size={15} className={isActive(id) ? 'text-[#C6C954]' : ''} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-0.5 max-md:flex max-md:items-center max-md:gap-1 max-md:overflow-x-auto max-md:space-y-0 max-md:py-2">
        {bottomNav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left max-md:w-auto max-md:shrink-0 max-md:whitespace-nowrap max-md:px-3 max-md:py-2 ${isActive(id) ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/8'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
        <div className="px-3 py-3 flex items-center gap-2.5 max-md:shrink-0 max-md:px-2 max-md:py-1">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">{userInitials(userName, userEmail)}</div>
          <div className="max-md:hidden">
            <p className="text-white/80 text-xs font-semibold">{userName || userEmail}</p>
            {userEmail && <p className="text-white/40 text-[10px]">{userEmail}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
