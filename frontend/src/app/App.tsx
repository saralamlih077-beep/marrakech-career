import { useEffect, useState } from 'react';
import { useEntreprises } from '../hooks/useEntreprises';
import { useFavorites } from '../hooks/useFavorites';
import { useProfile } from '../hooks/useProfile';
import { supabase, supabaseConfigError } from '../lib/supabaseClient';
import { trackActivity } from '../lib/activityTracking';
import { ChatBot } from './components/ChatBot';
import Sidebar from './components/Sidebar';
import AdminUsersScreen from './pages/AdminUsersScreen';
import AdminDataScreen from './pages/AdminDataScreen';
import AdminUserDirectoryScreen from './pages/AdminUserDirectoryScreen';
import AnalyticsScreen from './pages/AnalyticsScreen';
import ApplicationTrackerScreen from './pages/ApplicationTrackerScreen';
import CampaignScreen from './pages/CampaignScreen';
import CompaniesScreen from './pages/CompaniesScreen';
import CompanyDetailScreen from './pages/CompanyDetailScreen';
import CVAnalyzerScreen from './pages/CVAnalyzerScreen';
import CVStudioScreen from './pages/CVStudioScreen';
import TailoredCVScreen from './pages/TailoredCVScreen';
import DashboardScreen from './pages/DashboardScreen';
import FavoritesScreen from './pages/FavoritesScreen';
import LoginScreen from './pages/LoginScreen';
import LegalScreen from './pages/LegalScreen';
import MapScreen from './pages/MapScreen';
import OpportunitiesScreen from './pages/OpportunitiesScreen';
import ProfileScreen from './pages/ProfileScreen';
import ResetPasswordScreen from './pages/ResetPasswordScreen';
import SettingsScreen from './pages/SettingsScreen';
import type { Company, NavPage } from './types';
import type { JobOffer } from '../hooks/useJobOffers';

export default function App() {
  if (window.location.pathname === '/privacy') return <LegalScreen page="privacy" />;
  if (window.location.pathname === '/terms') return <LegalScreen page="terms" />;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionEmail, setSessionEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  // Google returns here after the administrator grants Gmail permission.
  // Open Settings directly so the callback can store the one-time token.
  const [page, setPage] = useState<NavPage>(() => (
    new URLSearchParams(window.location.search).get('gmail') === 'connected'
      ? 'settings'
      : 'dashboard'
  ));
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [cvCompany, setCvCompany] = useState<Company | null>(null);
  const [cvReturnPage, setCvReturnPage] = useState<NavPage>('companies');
  const [campaignCompanyId, setCampaignCompanyId] = useState<number | null>(null);
  const [campaignOffer, setCampaignOffer] = useState<JobOffer | null>(null);
  const [mapOffer, setMapOffer] = useState<JobOffer | null>(null);
  const { favorites: favs, toggleFavorite: toggleFav } = useFavorites();
  const { data: companies, loading, error } = useEntreprises();
  const { profile, email: userEmail, loading: profileLoading, avatarChoice } = useProfile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [checkedEmail, setCheckedEmail] = useState('');
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('reset-password') === 'true';
  const offerFromEmail = new URLSearchParams(window.location.search).get('offer');

  useEffect(() => {
    if (isLoggedIn && (offerFromEmail || new URLSearchParams(window.location.search).get('alerts') === 'manage')) setPage('opportunities');
  }, [isLoggedIn, offerFromEmail]);

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
      setSessionEmail(data.session?.user.email || '');
      setAdminLoading(Boolean(data.session));
      setAuthLoading(false);
      saveOfficialGmail(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setSessionEmail(session?.user.email || '');
      setAuthLoading(false);
      saveOfficialGmail(session);
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
        <p className="mt-4 text-xs text-[#78716C]">L’URL et la clé anonyme sont dans Supabase → Settings → API. Les clés IA restent protégées dans les secrets des Edge Functions et ne doivent jamais être placées dans Vercel.</p>
      </div>
    </div>
  );
  if (isPasswordRecovery) return <ResetPasswordScreen />;
  if (!isLoggedIn) return <LoginScreen />;
  if (profileLoading || adminLoading || checkedEmail !== sessionEmail) return <div className="h-dvh flex items-center justify-center bg-[#FBF9F7] text-[#78716C]">Chargement de votre espace…</div>;

  const screen = (() => {
    switch (activePage) {
      case 'dashboard': return <DashboardScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onNavigate={setPage} onTailoredCv={openTailoredCv} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} />;
      case 'companies': return <CompaniesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onTailoredCv={openTailoredCv} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} />;
      case 'company-detail': return selectedCompany
        ? <CompanyDetailScreen company={selectedCompany} isFav={favs.has(selectedCompany.id)} onFav={toggleFav} onBack={() => setPage('companies')} onNavigate={setPage} onCampaign={(id) => { setCampaignOffer(null); setCampaignCompanyId(id); setPage('campaign'); }} />
        : null;
      case 'map': return <MapScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} focusedOffer={mapOffer} onClearFocusedOffer={() => setMapOffer(null)} />;
      case 'opportunities': return <OpportunitiesScreen onNavigate={setPage} focusOfferId={offerFromEmail} onViewOnMap={(offer) => { setMapOffer(offer); setPage('map'); }} onApply={(offer) => { setCampaignOffer(offer); setCampaignCompanyId(offer.entreprise_id); setPage('campaign'); }} />;
      case 'cv-studio': return <CVStudioScreen onAnalyze={() => setPage('cv-analyzer')} onGenerate={() => { setCvCompany(null); setCvReturnPage('cv-studio'); setPage('cv-tailored'); }} />;
      case 'cv-analyzer': return <CVAnalyzerScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onTailoredCv={openTailoredCv} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} onBack={() => setPage('cv-studio')} />;
      case 'cv-tailored': return <TailoredCVScreen key={cvCompany?.id ?? 'general'} initialCompany={cvCompany} onChooseCompany={() => setPage('companies')} onBack={() => setPage(cvReturnPage)} />;
      case 'applications': return <ApplicationTrackerScreen companies={companies} favs={favs} onCampaign={() => setPage('campaign')} />;
      case 'campaign': return <CampaignScreen companies={companies} favorites={favs} initialCompanyId={campaignCompanyId} initialOffer={campaignOffer} loading={loading} error={error} onBack={() => setPage('applications')} />;
      case 'favorites': return <FavoritesScreen companies={companies} loading={loading} error={error} favs={favs} onFav={toggleFav} onView={viewCompany} onTailoredCv={openTailoredCv} onApply={(company) => { setCampaignOffer(null); setCampaignCompanyId(company.id); setPage('campaign'); }} />;
      case 'analytics': return <AnalyticsScreen companies={companies} />;
      case 'admin-data': return <AdminDataScreen companies={companies} loading={loading} error={error} />;
      case 'admin-users': return <AdminUsersScreen onDirectory={() => setPage('admin-user-directory')} />;
      case 'admin-user-directory': return <AdminUserDirectoryScreen />;
      case 'profile': return <ProfileScreen isAdmin={isAdmin} />;
      case 'settings': return <SettingsScreen />;
      default: return null;
    }
  })();

  return (
    <div className="flex h-dvh overflow-hidden" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Sidebar active={activePage} onNavigate={setPage} userName={profile.full_name} userEmail={userEmail} isAdmin={isAdmin} avatarChoice={avatarChoice} />
      <main className="flex min-h-0 min-w-0 flex-1 pt-[68px] md:pt-0">
        {screen}
      </main>
      {!isAdmin && <ChatBot />}
    </div>
  );
}
