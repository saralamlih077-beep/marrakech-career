import { useEffect, useState } from 'react';
import { useEntreprises } from '../hooks/useEntreprises';
import { useFavorites } from '../hooks/useFavorites';
import { useProfile } from '../hooks/useProfile';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import Sidebar from './components/Sidebar';
import AIAssistantScreen from './screens/AIAssistantScreen';
import AIMatchingScreen from './screens/AIMatchingScreen';
import AdminScreen from './screens/AdminScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import ApplicationTrackerScreen from './screens/ApplicationTrackerScreen';
import AutomationScreen from './screens/AutomationScreen';
import CampaignScreen from './screens/CampaignScreen';
import CompaniesScreen from './screens/CompaniesScreen';
import CompanyDetailScreen from './screens/CompanyDetailScreen';
import CVAnalyzerScreen from './screens/CVAnalyzerScreen';
import CVStudioScreen from './screens/CVStudioScreen';
import DashboardScreen from './screens/DashboardScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import LoginScreen from './screens/LoginScreen';
import MapScreen from './screens/MapScreen';
import OpportunitiesScreen from './screens/OpportunitiesScreen';
import ProfileScreen from './screens/ProfileScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import SettingsScreen from './screens/SettingsScreen';
import type { Company, NavPage } from './types';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState<NavPage>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const { favorites: favs, toggleFavorite: toggleFav } = useFavorites();
  const { data: companies, loading, error } = useEntreprises();
  const { profile, email: userEmail } = useProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('reset-password') === 'true';

  useEffect(() => {
    if (!isLoggedIn || !userEmail) { setIsAdmin(false); return; }
    void supabase.functions.invoke('admin-analytics').then(({ data, error: adminError }) => {
      setIsAdmin(!adminError && Boolean(data));
    });
  }, [isLoggedIn, userEmail]);

  useEffect(() => {
    if (supabaseConfigError) {
      setAuthLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session));
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const viewCompany = (c: Company) => {
    setSelectedCompany(c);
    setPage('company-detail');
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-[#FBF9F7] text-[#78716C]">Loading...</div>;
  if (supabaseConfigError) return (
    <div className="h-screen flex items-center justify-center bg-[#FBF9F7] p-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="max-w-xl bg-white border border-[#EAE5E0] rounded-2xl shadow-sm p-7 text-center">
        <h1 className="text-xl font-bold text-[#1C1917]">Configuration requise</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#57534E]">Les variables Supabase requises ne sont pas configurées pour cette version de l’application.</p>
        <pre className="mt-5 whitespace-pre-wrap text-left rounded-xl bg-[#FBF9F7] border border-[#EAE5E0] p-4 text-xs text-[#621E3E]">VITE_SUPABASE_URL=...{`\n`}VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="mt-4 text-xs text-[#78716C]">L’URL et la clé anonyme sont dans Supabase → Settings → API. Les clés IA restent protégées dans les secrets des Edge Functions et ne doivent jamais être placées dans Vercel.</p>
      </div>
    </div>
  );
  if (isPasswordRecovery) return <ResetPasswordScreen />;
  if (!isLoggedIn) return <LoginScreen />;

  const screen = (() => {
    switch (page) {
      case 'dashboard': return <DashboardScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onNavigate={setPage} />;
      case 'companies': return <CompaniesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'company-detail': return selectedCompany
        ? <CompanyDetailScreen company={selectedCompany} isFav={favs.has(selectedCompany.id)} onFav={toggleFav} onBack={() => setPage('companies')} onNavigate={setPage} />
        : null;
      case 'map': return <MapScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'matching': return <AIMatchingScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'opportunities': return <OpportunitiesScreen onNavigate={setPage} />;
      case 'assistant': return <AIAssistantScreen companies={companies} loading={loading} error={error} onView={viewCompany} />;
      case 'cv-studio': return <CVStudioScreen onAnalyze={() => setPage('cv-analyzer')} />;
      case 'cv-analyzer': return <CVAnalyzerScreen onBack={() => setPage('cv-studio')} />;
      case 'applications': return <ApplicationTrackerScreen companies={companies} favs={favs} onCampaign={() => setPage('campaign')} onAutomation={() => setPage('automation')} />;
      case 'campaign': return <CampaignScreen companies={companies} favorites={favs} loading={loading} error={error} onBack={() => setPage('applications')} />;
      case 'automation': return <AutomationScreen onBack={() => setPage('applications')} />;
      case 'favorites': return <FavoritesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'analytics': return <AnalyticsScreen companies={companies} />;
      case 'admin': return isAdmin ? <AdminScreen /> : <DashboardScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onNavigate={setPage} />;
      case 'profile': return <ProfileScreen />;
      case 'settings': return <SettingsScreen />;
      default: return null;
    }
  })();

  return (
    <div className="flex h-dvh overflow-hidden max-md:flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Sidebar active={page} onNavigate={setPage} userName={profile.full_name} userEmail={userEmail} isAdmin={isAdmin} />
      {screen}
    </div>
  );
}
