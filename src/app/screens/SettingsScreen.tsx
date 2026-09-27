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
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordChangedAt, setPasswordChangedAt] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const value = data.user?.user_metadata?.password_updated_at;
      setPasswordChangedAt(typeof value === 'string' ? value : null);
    });
  }, []);

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
          scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
        },
      });
      if (!active) return;
      if (saveError) {
        setGmailStatus('error');
        setGmailMessage(`Connexion Google effectuée, mais le serveur Gmail n’est pas prêt : ${saveError.message}`);
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
        scopes: 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (connectError) {
      setGmailStatus('error');
      setGmailMessage(connectError.message);
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(''); setPasswordMessage('');
    if (!email) { setPasswordError('Votre session a expiré. Connectez-vous de nouveau.'); return; }
    if (newPassword.length < 6) { setPasswordError('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return; }
    if (newPassword !== passwordConfirmation) { setPasswordError('Les deux nouveaux mots de passe ne sont pas identiques.'); return; }
    setChangingPassword(true);
    // Check the existing password first so this action is meaningful and cannot
    // be triggered by somebody who only has temporary access to an open session.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPasswordError('Le mot de passe actuel est incorrect.');
      setChangingPassword(false);
      return;
    }
    const changedAt = new Date().toISOString();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword, data: { password_updated_at: changedAt } });
    setChangingPassword(false);
    if (updateError) { setPasswordError(`Impossible de modifier le mot de passe : ${updateError.message}`); return; }
    setPasswordChangedAt(changedAt);
    setCurrentPassword(''); setNewPassword(''); setPasswordConfirmation('');
    setPasswordMessage('Mot de passe modifié avec succès.');
    setShowPasswordForm(false);
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
          <Row label="Langue de l’application" sub="Choisissez Français, English ou العربية.">
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
          <Row label="Match threshold" sub="Minimum match score to display">
            <input type="range" min={40} max={95} defaultValue={60} className="w-28 accent-[#621E3E]" />
          </Row>
        </Section>

        <Section title="Email">
          <Row label="Email account" sub={email || 'Email non renseigné'}>
            <span className="text-xs font-semibold text-[#667436] bg-[#667436]/10 px-2 py-1 rounded-lg">Supabase ✓</span>
          </Row>
          <Row label="Gmail personnel" sub={gmailStatus === 'connected' ? gmailMessage || 'Connecté : les candidatures partiront de ce compte.' : 'Connectez le Gmail qui doit envoyer vos candidatures et recevoir les réponses.'}>
            {gmailStatus === 'connected' ? <span className="text-xs font-semibold text-[#667436] bg-[#667436]/10 px-2 py-1 rounded-lg">Connecté</span> : <button onClick={() => void connectGmail()} disabled={gmailStatus === 'checking'} className="flex items-center gap-1.5 rounded-lg bg-[#621E3E] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Link2 size={13} />{gmailStatus === 'checking' ? 'Vérification…' : 'Connecter Gmail'}</button>}
          </Row>
          {gmailStatus === 'error' && <p className="text-xs text-red-700">{gmailMessage}</p>}
        </Section>

        <Section title="Security">
          <Row label="Mot de passe" sub={passwordChangedAt ? `Dernière modification : ${new Date(passwordChangedAt).toLocaleDateString('fr-FR')}` : 'Aucune modification enregistrée'}>
            <button onClick={() => { setShowPasswordForm(value => !value); setPasswordError(''); setPasswordMessage(''); }} className="flex items-center gap-1.5 text-xs text-[#78716C] font-semibold hover:text-[#621E3E]">
              <Lock size={12} /> Modifier
            </button>
          </Row>
          {passwordMessage && <p className="rounded-lg bg-[#667436]/10 p-3 text-xs font-medium text-[#4a4d1a]">{passwordMessage}</p>}
          {showPasswordForm && <form onSubmit={changePassword} className="space-y-3 rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-4">
            <p className="text-xs text-[#57534E]">Confirmez votre mot de passe actuel avant d’en choisir un nouveau.</p>
            <input required type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Mot de passe actuel" className="w-full rounded-xl border border-[#EAE5E0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#621E3E]" />
            <input required minLength={6} type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Nouveau mot de passe (6 caractères minimum)" className="w-full rounded-xl border border-[#EAE5E0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#621E3E]" />
            <input required minLength={6} type="password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} placeholder="Confirmer le nouveau mot de passe" className="w-full rounded-xl border border-[#EAE5E0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#621E3E]" />
            {passwordError && <p className="text-xs font-medium text-red-700">{passwordError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowPasswordForm(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#78716C]">Annuler</button><button disabled={changingPassword} type="submit" className="rounded-lg bg-[#621E3E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{changingPassword ? 'Modification…' : 'Enregistrer le mot de passe'}</button></div>
          </form>}
        </Section>
      </div>
    </div>
  );
}
