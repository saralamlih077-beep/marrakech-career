import { useEffect, useState } from 'react';
import { useEntreprises } from '../hooks/useEntreprises';
import { useFavorites } from '../hooks/useFavorites';
import { useProfile } from '../hooks/useProfile';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import Sidebar from './components/Sidebar';
import {
  AIAssistantScreen, AIMatchingScreen, AdminScreen, AnalyticsScreen,
  ApplicationTrackerScreen, AutomationScreen, CampaignScreen, CompaniesScreen,
  CompanyDetailScreen, CVAnalyzerScreen, CVStudioScreen, DashboardScreen,
  FavoritesScreen, LoginScreen, MapScreen, OpportunitiesScreen, ProfileScreen,
  ResetPasswordScreen, SettingsScreen,
} from './pages';
import type { Company, NavPage } from './types';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
        <p className="mt-3 text-sm leading-relaxed text-[#57534E]">Le fichier <code>.env</code> est absent. Créez-le à la racine du projet puis redémarrez <code>npm run dev</code>.</p>
        <pre className="mt-5 whitespace-pre-wrap text-left rounded-xl bg-[#FBF9F7] border border-[#EAE5E0] p-4 text-xs text-[#621E3E]">VITE_SUPABASE_URL=...{`\n`}VITE_SUPABASE_ANON_KEY=...{`\n`}VITE_GEMINI_API_KEY=...</pre>
        <p className="mt-4 text-xs text-[#78716C]">L’URL et la clé anonyme sont dans Supabase → Settings → API. La clé Gemini est disponible dans Google AI Studio. Ne partagez aucune de ces valeurs dans le chat.</p>
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
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Sidebar active={page} onNavigate={setPage} userName={profile.full_name} userEmail={userEmail} isAdmin={isAdmin} />
      <main className="flex min-h-0 min-w-0 flex-1 pt-[68px] md:pt-0">{screen}</main>
    </div>
  );
}
