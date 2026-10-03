import { useEffect, useState } from 'react';
import { useEntreprises } from '../hooks/useEntreprises';
import { useFavorites } from '../hooks/useFavorites';
import { useProfile } from '../hooks/useProfile';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import { trackActivity } from '../lib/activityTracking';
import { ChatBot } from './components/ChatBot';
import Sidebar from './components/Sidebar';
import {
  AIAssistantScreen, AIMatchingScreen, AdminDataScreen, AdminUsersScreen, AdminUserDirectoryScreen, AnalyticsScreen,
  ApplicationTrackerScreen, AutomationScreen, CampaignScreen, CompaniesScreen,
  CompanyDetailScreen, CVAnalyzerScreen, CVStudioScreen, DashboardScreen,
  FavoritesScreen, LoginScreen, MapScreen, OpportunitiesScreen, ProfileScreen,
  ResetPasswordScreen, SettingsScreen, TailoredCVScreen,
} from './pages';
import type { Company, NavPage } from './types';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionEmail, setSessionEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const oauthParams = new URLSearchParams(window.location.search);
  // Google returns here after the administrator grants Gmail permission.
  // Render Settings immediately so its callback can securely save the
  // one-time refresh token before the dashboard is shown.
  const [page, setPage] = useState<NavPage>(() => (
    oauthParams.get('gmail') === 'connected' || oauthParams.get('error_code') === 'identity_already_exists'
      ? 'settings'
      : 'dashboard'
  ));
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [cvCompany, setCvCompany] = useState<Company | null>(null);
  const [cvReturnPage, setCvReturnPage] = useState<NavPage>('companies');
  const { favorites: favs, toggleFavorite: toggleFav } = useFavorites();
  const { data: companies, loading, error } = useEntreprises();
  const { profile, email: userEmail, loading: profileLoading } = useProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [checkedEmail, setCheckedEmail] = useState('');
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('reset-password') === 'true';

  useEffect(() => {
    let active = true;
    if (!isLoggedIn || !sessionEmail) { setIsAdmin(false); setCheckedEmail(''); setAdminLoading(false); return; }
    setAdminLoading(true);
    void supabase.functions.invoke('admin-analytics').then(({ data, error: adminError }) => {
      if (!active) return;
      setIsAdmin(!adminError && Boolean(data?.users));
      setCheckedEmail(sessionEmail);
      setAdminLoading(false);
    }).catch(() => {
      if (!active) return;
      setIsAdmin(false);
      setCheckedEmail(sessionEmail);
      setAdminLoading(false);
    });
    return () => { active = false; };
  }, [isLoggedIn, sessionEmail]);

  useEffect(() => {
    if (supabaseConfigError) {
      setAuthLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session));
      setSessionEmail(data.session?.user.email || '');
      setAdminLoading(Boolean(data.session));
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setSessionEmail(session?.user.email || '');
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const adminPages: NavPage[] = ['admin-data', 'admin-users', 'admin-user-directory', 'profile', 'settings'];
  const activePage = isAdmin
    ? (adminPages.includes(page) ? page : 'admin-data')
    : (page === 'admin-data' || page === 'admin-users' || page === 'admin-user-directory' ? 'dashboard' : page);

  useEffect(() => {
    if (!isLoggedIn || adminLoading || checkedEmail !== sessionEmail) return;
    void trackActivity('session_start');
  }, [isLoggedIn, adminLoading, checkedEmail, sessionEmail]);

  useEffect(() => {
    if (!isLoggedIn || adminLoading || checkedEmail !== sessionEmail) return;
    if (activePage === 'cv-studio' || activePage === 'cv-analyzer' || activePage === 'cv-tailored') void trackActivity('cv_view');
    if (activePage === 'opportunities') void trackActivity('offer_view');
  }, [activePage, isLoggedIn, adminLoading, checkedEmail, sessionEmail]);

  const viewCompany = (c: Company) => {
    setSelectedCompany(c);
    setPage('company-detail');
  };
  const openTailoredCv = (company: Company) => {
    setCvCompany(company);
    setCvReturnPage(activePage);
    setPage('cv-tailored');
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-[#FBF9F7] text-[#78716C]">Loading...</div>;
  if (supabaseConfigError) return (
    <div className="h-screen flex items-center justify-center bg-[#FBF9F7] p-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="max-w-xl bg-white border border-[#EAE5E0] rounded-2xl shadow-sm p-7 text-center">
        <h1 className="text-xl font-bold text-[#1C1917]">Configuration requise</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#57534E]">Les variables Supabase requises ne sont pas configurées pour cette version de l’application.</p>
        <pre className="mt-5 whitespace-pre-wrap text-left rounded-xl bg-[#FBF9F7] border border-[#EAE5E0] p-4 text-xs text-[#621E3E]">VITE_SUPABASE_URL=...{`\n`}VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="mt-4 text-xs text-[#78716C]">Les clés IA restent protégées dans les secrets des Edge Functions Supabase.</p>
      </div>
    </div>
  );
  if (isPasswordRecovery) return <ResetPasswordScreen />;
  if (!isLoggedIn) return <LoginScreen />;
  if (profileLoading || adminLoading || checkedEmail !== sessionEmail) return <div className="h-dvh flex items-center justify-center bg-[#FBF9F7] text-[#78716C]">Chargement de votre espace…</div>;

  const screen = (() => {
    switch (activePage) {
      case 'dashboard': return <DashboardScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onNavigate={setPage} onApply={viewCompany} onTailoredCv={openTailoredCv} />;
      case 'companies': return <CompaniesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onApply={viewCompany} onTailoredCv={openTailoredCv} />;
      case 'company-detail': return selectedCompany
        ? <CompanyDetailScreen company={selectedCompany} isFav={favs.has(selectedCompany.id)} onFav={toggleFav} onBack={() => setPage('companies')} onNavigate={setPage} />
        : null;
      case 'map': return <MapScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'matching': return <AIMatchingScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'opportunities': return <OpportunitiesScreen onNavigate={setPage} />;
      case 'assistant': return <AIAssistantScreen companies={companies} loading={loading} error={error} onView={viewCompany} />;
      case 'cv-studio': return <CVStudioScreen onAnalyze={() => setPage('cv-analyzer')} onGenerate={() => { setCvCompany(null); setCvReturnPage('cv-studio'); setPage('cv-tailored'); }} />;
      case 'cv-analyzer': return <CVAnalyzerScreen onBack={() => setPage('cv-studio')} />;
      case 'cv-tailored': return <TailoredCVScreen key={cvCompany?.id ?? 'general'} initialCompany={cvCompany} onChooseCompany={() => setPage('companies')} onBack={() => setPage(cvReturnPage)} />;
      case 'applications': return <ApplicationTrackerScreen companies={companies} favs={favs} onCampaign={() => setPage('campaign')} onAutomation={() => setPage('automation')} />;
      case 'campaign': return <CampaignScreen companies={companies} favorites={favs} loading={loading} error={error} onBack={() => setPage('applications')} />;
      case 'automation': return <AutomationScreen onBack={() => setPage('applications')} />;
      case 'favorites': return <FavoritesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onTailoredCv={openTailoredCv} />;
      case 'analytics': return <AnalyticsScreen companies={companies} />;
      case 'admin-data': return <AdminDataScreen companies={companies} loading={loading} error={error} />;
      case 'admin-users': return <AdminUsersScreen onDirectory={() => setPage('admin-user-directory')} />;
      case 'admin-user-directory': return <AdminUserDirectoryScreen />;
      case 'profile': return <ProfileScreen />;
      case 'settings': return <SettingsScreen />;
      default: return null;
    }
  })();

  return (
    <div className="flex h-dvh overflow-hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Sidebar active={activePage} onNavigate={setPage} userName={profile.full_name} userEmail={userEmail} isAdmin={isAdmin} />
      <main className="flex min-h-0 min-w-0 flex-1 pt-[68px] md:pt-0">{screen}</main>
      {!isAdmin && <ChatBot />}
    </div>
  );
}
