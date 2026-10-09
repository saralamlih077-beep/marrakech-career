import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { AuthBrandPanel } from './auth-components/AuthBrandPanel';
import { GoogleLogo } from './auth-components/GoogleLogo';
import './login.css';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../i18n';

export default function LoginScreen() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'idle' | 'code'>('idle');
  const [resetCode, setResetCode] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const needsConfirmation = confirmationEmail !== '' && confirmationEmail.toLowerCase() === email.trim().toLowerCase();

  useEffect(() => {
    window.localStorage.removeItem('marrakech-career-remembered-email');
  }, []);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const frame = window.requestAnimationFrame(scrollToTop);

    return () => {
      window.cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const continueWithGoogle = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    const { error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (googleError) {
      setError(`Connexion Google impossible : ${googleError.message}`);
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    const address = email.trim();
    if (!address) {
      setError('Saisissez votre adresse e-mail puis cliquez sur « Mot de passe oublié ? ».');
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(address);
    if (resetError) setError(`Impossible d’envoyer le code : ${resetError.message}`);
    else {
      setResetStep('code');
      setMessage('Un code à 8 chiffres a été envoyé à votre adresse e-mail.');
    }
    setLoading(false);
  };

  const resendConfirmation = async () => {
    if (!needsConfirmation) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: confirmationEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (resendError) setError(`Impossible de renvoyer l’e-mail : ${resendError.message}`);
    else setMessage('Un nouvel e-mail de confirmation a été envoyé.');
    setLoading(false);
  };

  const verifyResetCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{8}$/.test(resetCode.trim())) {
      setError('Saisissez le code à 8 chiffres reçu par e-mail.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: verificationError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: resetCode.trim(),
      type: 'recovery',
    });
    if (verificationError) setError('Ce code est invalide ou a expiré. Demandez un nouveau code.');
    else {
      window.history.replaceState({}, '', `${window.location.pathname}?reset-password=true`);
      setMessage('Code vérifié. Choisissez maintenant un nouveau mot de passe.');
    }
    setLoading(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    setLoading(true);
    setMessage(null);
    setError(null);
    setConfirmationEmail('');

    const result = tab === 'login'
      ? await supabase.auth.signInWithPassword({ email: address, password: pwd })
      : await supabase.auth.signUp({
          email: address,
          password: pwd,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });

    if (result.error) {
      if (result.error.code === 'email_not_confirmed') {
        setConfirmationEmail(address);
        setError('Confirmez votre adresse e-mail pour vous connecter. Vous pouvez renvoyer l’e-mail de confirmation ci-dessous.');
      } else {
        setError(result.error.message);
      }
    } else if (tab === 'register' && !result.data.session) {
      setConfirmationEmail(address);
      setMessage('Compte créé. Vérifiez votre adresse email pour confirmer votre inscription.');
    }

    setLoading(false);
  };

  const switchTab = (mode: 'login' | 'register') => {
    setTab(mode);
    setError(null);
    setMessage(null);
    setResetStep('idle');
    setResetCode('');
    setPasswordVisible(false);
  };

  return (
    <main className="auth-page">
      <AuthBrandPanel />
      <section className="auth-form-panel" aria-labelledby="auth-form-title">
        <div className="auth-form-content">
          <div className="auth-tabs" role="group" aria-label="Connexion ou inscription">
            {(['login', 'register'] as const).map(mode => (
              <button key={mode} type="button" disabled={loading} onClick={() => switchTab(mode)} aria-pressed={tab === mode} className={tab === mode ? 'is-active' : ''}>
                {mode === 'login' ? t('signIn') : t('register')}
              </button>
            ))}
          </div>
          <div className="auth-intro">
            <h2 id="auth-form-title" className="auth-form-title">{tab === 'login' ? t('welcomeBack') : t('createAccount')}</h2>
            <p>{tab === 'login' ? t('existingAccount') : t('newAccount')}</p>
          </div>
          <button type="button" onClick={() => void continueWithGoogle()} disabled={loading} className="auth-google">
            <GoogleLogo />{t('continueGoogle')}
          </button>
          <div className="auth-divider">{t('emailSeparator')}</div>
          <form onSubmit={handleSubmit} autoComplete="off" className="auth-form">
            {tab === 'register' && (
              <div className="auth-field">
                <label htmlFor="auth-full-name">{t('fullName')}</label>
                <div className="auth-input-wrap">
                  <UserRound aria-hidden="true" />
                  <input id="auth-full-name" name="full-name" required value={name} onChange={event => setName(event.target.value)} placeholder="Votre nom complet" />
                </div>
              </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <div className="auth-input-wrap">
                <Mail aria-hidden="true" />
                <input id="auth-email" name="email" required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@exemple.com" />
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">{t('password')}</label>
              <div className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input id="auth-password" required minLength={6} type={passwordVisible ? 'text' : 'password'} name="marrakech-career-password" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" value={pwd} onChange={event => setPwd(event.target.value)} placeholder="Votre mot de passe" />
                <button type="button" className="auth-password-toggle" aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={passwordVisible} aria-controls="auth-password" onClick={() => setPasswordVisible(!passwordVisible)}>
                  {passwordVisible ? <Eye size={21} /> : <EyeOff size={21} />}
                </button>
              </div>
            </div>
            {tab === 'login' && (
              <div className="auth-forgot">
                <button type="button" onClick={() => void sendPasswordReset()} disabled={loading} className="auth-text-button">{t('forgotPassword')}</button>
              </div>
            )}
            {error && <p className="auth-feedback is-error" role="alert">{error}</p>}
            {message && <p className="auth-feedback is-success" role="status">{message}</p>}
            {needsConfirmation && <button type="button" onClick={() => void resendConfirmation()} disabled={loading} className="auth-text-button">Renvoyer l’e-mail de confirmation</button>}
            <button type="submit" disabled={loading} className="auth-submit">
              {loading ? t('wait') : tab === 'login' ? t('signIn') : t('create')}<ArrowRight size={21} aria-hidden="true" />
            </button>
          </form>
          {resetStep === 'code' && (
            <form onSubmit={verifyResetCode} className="auth-reset" aria-labelledby="auth-reset-title">
              <div><h3 id="auth-reset-title">Vérifier votre e-mail</h3><p>Saisissez le code reçu sur {email.trim()}.</p></div>
              <div className="auth-input-wrap">
                <input aria-label="Code de vérification à 8 chiffres" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={resetCode} onChange={event => setResetCode(event.target.value.replace(/\D/g, ''))} className="auth-reset-code" placeholder="00000000" />
              </div>
              <button disabled={loading} type="submit" className="auth-submit">{loading ? t('wait') : 'Vérifier le code'}</button>
            </form>
          )}
          <p className="auth-switch">
            {tab === 'login' ? 'Vous n’avez pas de compte ?' : 'Vous avez déjà un compte ?'}
            <button type="button" className="auth-text-button" disabled={loading} onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}>{tab === 'login' ? t('register') : t('signIn')}</button>
          </p>
          <nav className="auth-legal-links" aria-label="Informations légales"><a href="/privacy">Confidentialité</a><a href="/terms">Conditions d’utilisation</a></nav>
        </div>
      </section>
    </main>
  );
}
