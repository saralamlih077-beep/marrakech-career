import { useState } from 'react';
import {
  LayoutDashboard, Building2, Map,
  FileText, ClipboardList, Heart, BarChart3, User,
  Settings as Gear, Users, ContactRound, BriefcaseBusiness, CalendarDays, Menu, X,
} from 'lucide-react';
import type { NavPage } from '../types';
import ProfileAvatar from './ProfileAvatar';
import type { ProfileAvatarChoice } from '../../lib/profileAvatar';
import { useLanguage } from '../i18n';

type NavigationItem = {
  id: NavPage;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

export default function Sidebar({ active, onNavigate, userName, userEmail, isAdmin, avatarChoice }: {
  active: NavPage; onNavigate: (p: NavPage) => void; userName: string; userEmail: string; isAdmin: boolean;
  avatarChoice: ProfileAvatarChoice | null;
}) {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryNav: NavigationItem[] = isAdmin ? [
    { id: 'admin-data', label: 'Analyse des données', icon: BarChart3 },
    { id: 'admin-users', label: 'Analyse des utilisateurs', icon: Users },
    { id: 'admin-user-directory', label: 'Utilisateurs', icon: ContactRound },
  ] : [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'companies', label: t('companies'), icon: Building2 },
    { id: 'opportunities', label: 'Offres', icon: BriefcaseBusiness },
    { id: 'events', label: 'Événements', icon: CalendarDays },
    { id: 'map', label: t('map'), icon: Map },
    { id: 'cv-studio', label: t('cvStudio'), icon: FileText },
    { id: 'applications', label: t('applications'), icon: ClipboardList },
    { id: 'favorites', label: t('favorites'), icon: Heart },
  ];
  const bottomNav: NavigationItem[] = [
    { id: 'profile', label: t('profile'), icon: User },
    { id: 'settings', label: t('settings'), icon: Gear },
  ];

  const isActive = (id: NavPage) =>
    id === active ||
    (id === 'companies' && active === 'company-detail') ||
    (id === 'cv-studio' && active === 'cv-analyzer') ||
    (id === 'applications' && active === 'campaign');

  const navigate = (id: NavPage) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const navigationButtons = (items: NavigationItem[]) => items.map(({ id, label, icon: Icon }) => (
    <button
      key={id}
      onClick={() => navigate(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
        isActive(id)
          ? 'bg-white/15 text-white border-l-2 border-[#C6C954]'
          : 'text-white/65 hover:text-white hover:bg-white/10'
      }`}
    >
      <Icon size={16} className={isActive(id) ? 'text-[#C6C954]' : ''} />
      {label}
    </button>
  ));

  const brand = (
    <img src="/brand/marrakech-career.svg" alt="Marrakech Career" width={440} height={128} className="h-auto w-[168px] shrink-0" />
  );

  const userBlock = (
    <div className="flex items-center gap-2.5 px-3 py-3">
      <ProfileAvatar choice={avatarChoice} name={userName} email={userEmail} isAdmin={isAdmin} className="h-8 w-8 text-xs" />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-white/90">{userName || userEmail}</p>
        {userEmail && <p className="truncate text-[10px] text-white/50">{userEmail}</p>}
      </div>
    </div>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-[68px] items-center justify-between border-b border-white/10 bg-[#621E3E] px-4 shadow-md md:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={mobileMenuOpen}
          className="rounded-xl p-2 text-white hover:bg-white/10"
        >
          <Menu size={25} />
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu de navigation">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/45" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative flex h-full w-[min(82vw,320px)] flex-col bg-[#621E3E] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              {brand}
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fermer le menu" className="rounded-xl p-2 text-white hover:bg-white/10">
                <X size={22} />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">{navigationButtons(primaryNav)}</nav>
            <div className="space-y-0.5 border-t border-white/10 px-3 pb-3 pt-3">
              {navigationButtons(bottomNav)}
              {userBlock}
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden h-full w-52 shrink-0 flex-col bg-[#621E3E] md:flex">
        <div className="border-b border-white/10 px-5 py-5">{brand}</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">{navigationButtons(primaryNav)}</nav>
        <div className="space-y-0.5 border-t border-white/10 px-3 pb-3 pt-3">
          {navigationButtons(bottomNav)}
          {userBlock}
        </div>
      </aside>
    </>
  );
}
