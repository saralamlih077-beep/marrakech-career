import { useEffect, useState } from 'react';
import { useEntreprises } from '../hooks/useEntreprises';
import { useFavorites } from '../hooks/useFavorites';
import { useProfile } from '../hooks/useProfile';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import { ChatBot } from './components/ChatBot';
import Sidebar from './components/Sidebar';
import AdminScreen from './screens/AdminScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import ApplicationTrackerScreen from './screens/ApplicationTrackerScreen';
import CampaignScreen from './screens/CampaignScreen';
import CompaniesScreen from './screens/CompaniesScreen';
import CompanyDetailScreen from './screens/CompanyDetailScreen';
import CVAnalyzerScreen from './screens/CVAnalyzerScreen';
import CVStudioScreen from './screens/CVStudioScreen';
import DashboardScreen from './screens/DashboardScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import LoginScreen from './screens/LoginScreen';
import LegalScreen from './screens/LegalScreen';
import MapScreen from './screens/MapScreen';
import OpportunitiesScreen from './screens/OpportunitiesScreen';
import ProfileScreen from './screens/ProfileScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import SettingsScreen from './screens/SettingsScreen';
import type { Company, NavPage } from './types';
import type { JobOffer } from '../hooks/useJobOffers';

export default function App() {
  if (window.location.pathname === '/privacy') return <LegalScreen page="privacy" />;
  if (window.location.pathname === '/terms') return <LegalScreen page="terms" />;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  // Google returns here after the administrator grants Gmail permission.
  // Open Settings directly so the callback can store the one-time token.
  const [page, setPage] = useState<NavPage>(() => (
    new URLSearchParams(window.location.search).get('gmail') === 'connected'
      ? 'settings'
      : 'dashboard'
  ));
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [campaignCompanyId, setCampaignCompanyId] = useState<number | null>(null);
  const [campaignOffer, setCampaignOffer] = useState<JobOffer | null>(null);
  const [mapOffer, setMapOffer] = useState<JobOffer | null>(null);
  const { favorites: favs, toggleFavorite: toggleFav } = useFavorites();
  const { data: companies, loading, error } = useEntreprises();
  const { profile, email: userEmail } = useProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('reset-password') === 'true';
  const offerFromEmail = new URLSearchParams(window.location.search).get('offer');

  useEffect(() => {
    if (isLoggedIn && offerFromEmail) setPage('opportunities');
  }, [isLoggedIn, offerFromEmail]);

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
    const saveOfficialGmail = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (new URLSearchParams(window.location.search).get('gmail') !== 'connected') return;
      const gmailSession = session as (typeof session & { provider_refresh_token?: string }) | null;
      const refreshToken = gmailSession?.provider_refresh_token;
      const googleIdentity = gmailSession?.user.identities?.find((identity) => identity.provider === 'google');
      const googleEmail = typeof googleIdentity?.identity_data?.email === 'string'
        ? googleIdentity.identity_data.email
        : gmailSession?.user.email;
      if (!refreshToken || !googleEmail) return;
      // Google only exposes this refresh token during the OAuth callback.
      window.setTimeout(() => {
        void supabase.functions.invoke('save-gmail-connection', {
          body: { email: googleEmail, refreshToken, scopes: ['https://www.googleapis.com/auth/gmail.send'] },
        }).then(({ error: saveError }) => {
          if (!saveError) window.history.replaceState({}, '', window.location.pathname);
        });
      }, 0);
    };

    void supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(Boolean(data.session));
      setAuthLoading(false);
      saveOfficialGmail(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setAuthLoading(false);
      saveOfficialGmail(session);
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
      case 'dashboard': return <DashboardScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onNavigate={setPage} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} />;
      case 'companies': return <CompaniesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} />;
      case 'company-detail': return selectedCompany
        ? <CompanyDetailScreen company={selectedCompany} isFav={favs.has(selectedCompany.id)} onFav={toggleFav} onBack={() => setPage('companies')} onNavigate={setPage} onCampaign={(id) => { setCampaignOffer(null); setCampaignCompanyId(id); setPage('campaign'); }} />
        : null;
      case 'map': return <MapScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} focusedOffer={mapOffer} onClearFocusedOffer={() => setMapOffer(null)} />;
      case 'opportunities': return <OpportunitiesScreen onNavigate={setPage} focusOfferId={offerFromEmail} onViewOnMap={(offer) => { setMapOffer(offer); setPage('map'); }} onApply={(offer) => { setCampaignOffer(offer); setCampaignCompanyId(offer.entreprise_id); setPage('campaign'); }} />;
      case 'cv-studio': return <CVStudioScreen onAnalyze={() => setPage('cv-analyzer')} />;
      case 'cv-analyzer': return <CVAnalyzerScreen onBack={() => setPage('cv-studio')} />;
      case 'applications': return <ApplicationTrackerScreen companies={companies} favs={favs} onCampaign={() => setPage('campaign')} />;
      case 'campaign': return <CampaignScreen companies={companies} favorites={favs} initialCompanyId={campaignCompanyId} initialOffer={campaignOffer} loading={loading} error={error} onBack={() => setPage('applications')} />;
      case 'favorites': return <FavoritesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} />;
      case 'analytics': return <AnalyticsScreen companies={companies} />;
      case 'admin': return isAdmin ? <AdminScreen /> : <DashboardScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onNavigate={setPage} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} />;
      case 'profile': return <ProfileScreen />;
      case 'settings': return <SettingsScreen />;
      default: return null;
    }
  })();

  return (
    <div className="flex h-dvh overflow-hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Sidebar active={page} onNavigate={setPage} userName={profile.full_name} userEmail={userEmail} isAdmin={isAdmin} />
      <main className="flex min-h-0 min-w-0 flex-1 pt-[68px] md:pt-0">
        {screen}
      </main>
      <ChatBot />
    </div>
  );
}
