import { useEffect, useState } from 'react';
import { Link2, Lock } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabaseClient';
import { PageHeader } from '../components/shared';
import { LanguageSelect } from '../i18n';

export default function SettingsScreen() {
  const [notifs, setNotifs] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const { profile, email, loading, error } = useProfile();
  const [gmailStatus, setGmailStatus] = useState<'checking' | 'disconnected' | 'connected' | 'error'>('checking');
  const [gmailMessage, setGmailMessage] = useState('');

  useEffect(() => {
    let active = true;
    const refreshGmailStatus = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError) {
        setGmailStatus('error');
        setGmailMessage(userError.message);
        return;
      }
      const gmailSender = user?.user_metadata?.gmail_sender_email;
      const isGmailReady = typeof user?.user_metadata?.gmail_connected_at === 'string' && typeof gmailSender === 'string';
      setGmailStatus(isGmailReady ? 'connected' : 'disconnected');
      setGmailMessage(isGmailReady
        ? `Connecté : les candidatures partiront de ${gmailSender}.`
        : 'Gmail doit être connecté avec l’autorisation d’envoi avant de pouvoir envoyer une candidature.');
    };
    void refreshGmailStatus();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error_code') === 'identity_already_exists') {
      setGmailStatus('error');
      setGmailMessage('Ce compte Gmail est déjà lié à un autre profil Marrakech Career. Connectez-vous avec ce profil ou utilisez un autre compte Gmail.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (new URLSearchParams(window.location.search).get('gmail') !== 'connected') return;
    let active = true;
    const saveGooglePermission = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session as (typeof data.session & { provider_token?: string; provider_refresh_token?: string }) | null;
      const googleIdentity = session?.user.identities?.find((identity) => identity.provider === 'google');
      const googleEmail = typeof googleIdentity?.identity_data?.email === 'string' ? googleIdentity.identity_data.email : session?.user.email;
      if (!session?.provider_refresh_token || !googleEmail) {
        if (active) {
          setGmailStatus('error');
          setGmailMessage('Google n’a pas fourni l’autorisation permanente. Cliquez de nouveau sur Connecter Gmail et acceptez toutes les autorisations.');
        }
        return;
      }
      const { error: saveError } = await supabase.functions.invoke('save-gmail-connection', {
        body: {
          email: googleEmail,
          refreshToken: session.provider_refresh_token,
          scopes: ['https://www.googleapis.com/auth/gmail.send'],
        },
      });
      if (!active) return;
      if (saveError) {
        setGmailStatus('error');
        let serverMessage = saveError.message;
        if ('context' in saveError && saveError.context instanceof Response) {
          const payload = await saveError.context.clone().json().catch(() => null) as { error?: unknown } | null;
          if (typeof payload?.error === 'string') serverMessage = payload.error;
        }
        setGmailMessage(`Connexion Google effectuée, mais le serveur Gmail n’est pas prêt : ${serverMessage}`);
      } else {
        setGmailStatus('connected');
        setGmailMessage(`Connecté : les candidatures partiront de ${googleEmail}.`);
        window.history.replaceState({}, '', window.location.pathname);
      }
    };
    void saveGooglePermission();
    return () => { active = false; };
  }, []);

  const connectGmail = async () => {
    setGmailStatus('checking');
    setGmailMessage('Redirection vers Google…');
    const { error: connectError } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/?gmail=connected`,
        scopes: 'openid email profile https://www.googleapis.com/auth/gmail.send',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (connectError) {
      setGmailStatus('error');
      setGmailMessage(connectError.message);
    }
  };

  function Toggle({ v, onChange }: { v: boolean; onChange: () => void }) {
    return (
      <button onClick={onChange} className={`relative w-10 h-6 rounded-full transition-colors ${v ? 'bg-[#621E3E]' : 'bg-[#EAE5E0]'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${v ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#1C1917] mb-4">{title}</h3>
        <div className="space-y-4">{children}</div>
      </div>
    );
  }

  function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#1C1917]">{label}</p>
          {sub && <p className="text-xs text-[#78716C]">{sub}</p>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <PageHeader title="Settings" sub="Manage your account and preferences" />
      <div className="max-w-2xl space-y-4">
        <Section title="Account">
          <Row label="Email" sub={loading ? 'Chargement...' : email || 'Email non renseigné'}>
            <span className="text-xs text-[#78716C]">Supabase Auth</span>
          </Row>
          <Row label="Full Name" sub={loading ? 'Chargement...' : profile.full_name || 'Nom non renseigné'}>
            <span className="text-xs text-[#78716C]">Mon Profil</span>
          </Row>
          {error && <p className="text-xs text-red-700">{error}</p>}
        </Section>

        <Section title="Préférences">
          <Row label="Langue de l’application" sub="Choisissez Français, English ou Arabic.">
            <LanguageSelect />
          </Row>
        </Section>

        <Section title="Notifications">
          <Row label="Email notifications" sub="Receive match and application updates"><Toggle v={notifs} onChange={() => setNotifs(v => !v)} /></Row>
          <Row label="AI Suggestions" sub="Daily career improvement tips"><Toggle v={aiSuggestions} onChange={() => setAiSuggestions(v => !v)} /></Row>
        </Section>

        <Section title="AI Settings">
          <Row label="AI Provider" sub="Language model for career assistance">
            <select className="bg-[#FBF9F7] border border-[#EAE5E0] text-[#1C1917] text-sm rounded-xl px-3 py-1.5 focus:outline-none">
              <option>Gemini Pro</option><option>GPT-4</option><option>Claude</option>
            </select>
          </Row>
        </Section>

        <Section title="Email">
          <Row label="Email account" sub={email || 'Email non renseigné'}>
            <span className="text-xs font-semibold text-[#667436] bg-[#667436]/10 px-2 py-1 rounded-lg">Supabase ✓</span>
          </Row>
          <Row label="Gmail officiel Marrakech Career" sub="Seul l’administrateur connecte une fois marrakechcareer@gmail.com. Les candidats n’ont rien à connecter.">
            {gmailStatus === 'connected' ? <span className="text-xs font-semibold text-[#667436] bg-[#667436]/10 px-2 py-1 rounded-lg">Connecté</span> : <button onClick={() => void connectGmail()} disabled={gmailStatus === 'checking'} className="flex items-center gap-1.5 rounded-lg bg-[#621E3E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Link2 size={13} />{gmailStatus === 'checking' ? 'Vérification…' : 'Connecter Gmail officiel'}</button>}
          </Row>
          {gmailStatus === 'error' && <p className="text-xs text-red-700">{gmailMessage}</p>}
        </Section>

        <Section title="Security">
          <Row label="Password" sub="Last changed 30 days ago">
            <button className="flex items-center gap-1.5 text-xs text-[#78716C] font-semibold hover:text-[#621E3E]">
              <Lock size={12} /> Change
            </button>
          </Row>
        </Section>
      </div>
    </div>
  );
}
