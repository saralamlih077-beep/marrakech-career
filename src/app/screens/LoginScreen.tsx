import { useEffect, useState } from 'react';
import { Chrome, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../i18n';

export default function LoginScreen() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState<'idle' | 'code'>('idle');
  const [resetCode, setResetCode] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');

  useEffect(() => {
    window.localStorage.removeItem('marrakech-career-remembered-email');
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
    const address = confirmationEmail || email.trim();
    if (!address) {
      setError('Saisissez votre adresse e-mail puis cliquez sur « Renvoyer confirmation ».');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: address,
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
    setLoading(true);
    setMessage(null);
    setError(null);

    const result = tab === 'login'
      ? await supabase.auth.signInWithPassword({ email, password: pwd })
      : await supabase.auth.signUp({
          email,
          password: pwd,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });

    if (result.error) {
      setError(result.error.message);
    } else if (tab === 'register' && !result.data.session) {
      setConfirmationEmail(email.trim());
      setMessage('Compte créé. Vérifiez votre adresse email pour confirmer votre inscription.');
    }

    setLoading(false);
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#621E3E]">
      {/* Marrakech Career background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#D9828D]/20" />
        <div className="absolute -right-20 top-24 h-44 w-44 rounded-full bg-[#C6C954]/15" />
        <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(30deg,transparent_48%,white_49%,transparent_51%),linear-gradient(-30deg,transparent_48%,white_49%,transparent_51%)] [background-size:48px_84px]" />
        <div className="absolute -bottom-24 -left-16 hidden h-64 w-64 rounded-full bg-[#D9828D]/20 md:block" />
        <div className="absolute -right-20 bottom-10 hidden h-72 w-72 rounded-full bg-[#D9828D]/20 md:block" />
      </div>
      <div className="absolute left-6 top-4 z-10 flex items-center gap-2.5 md:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
          <MapPin size={17} className="text-[#C6C954]" />
        </div>
        <div>
          <p className="text-sm font-extrabold leading-tight text-white">Marrakech</p>
          <p className="text-[9px] font-extrabold tracking-[0.16em] text-[#E5E78F]">CAREER</p>
        </div>
      </div>
      <div className="absolute left-1/2 top-7 z-10 hidden -translate-x-1/2 items-center gap-4 md:flex">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <MapPin size={27} className="text-[#C6C954]" />
        </div>
        <div>
          <p className="text-2xl font-extrabold leading-tight text-white">Marrakech</p>
          <p className="text-sm font-extrabold tracking-[0.2em] text-[#E5E78F]">CAREER</p>
        </div>
      </div>
      {/* Left brand panel */}
      <div className="hidden">
        {/* Geometric Moroccan decoration */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="geo" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <polygon points="40,0 80,20 80,60 40,80 0,60 0,20" fill="none" stroke="white" strokeWidth="1"/>
              <circle cx="40" cy="40" r="12" fill="none" stroke="white" strokeWidth="0.8"/>
              <line x1="40" y1="0" x2="40" y2="80" stroke="white" strokeWidth="0.4"/>
              <line x1="0" y1="40" x2="80" y2="40" stroke="white" strokeWidth="0.4"/>
            </pattern>
          </defs>
          <rect width="400" height="900" fill="url(#geo)"/>
        </svg>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#D9828D]/20 rounded-full translate-x-32 translate-y-32" />
        <div className="absolute top-0 left-0 w-48 h-48 bg-[#C6C954]/10 rounded-full -translate-x-24 -translate-y-24" />

        <div className="relative flex flex-col justify-center h-full px-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
              <MapPin size={22} className="text-[#C6C954]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Marrakech</p>
              <p className="text-[#C6C954] text-xs font-bold tracking-widest">CAREER</p>
            </div>
          </div>

          <h2 className="text-white text-3xl font-extrabold leading-tight mb-4">
            Discover.<br />Match.<br />Apply.
          </h2>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            Find the right companies. Build your profile. Apply smarter in Marrakech.
          </p>

        </div>
      </div>

      {/* Right form panel */}
      <div className="relative z-10 mt-20 flex min-h-0 w-full flex-1 flex-col items-center justify-start rounded-t-[42px] bg-[#FBF9F7] px-6 py-4 md:mx-auto md:mt-28 md:w-[92%] md:max-w-3xl md:flex-none md:rounded-[34px] md:px-12 md:py-6">
        <div className="w-full max-w-md">
          <div className="mb-3 flex w-fit gap-1 rounded-xl bg-[#EAE5E0] p-1 md:mb-5">
            {(['login', 'register'] as const).map(mode => (
              <button key={mode} onClick={() => setTab(mode)} className={`rounded-lg px-4 py-1 text-sm font-semibold capitalize transition-all md:px-4 md:py-1.5 ${tab === mode ? 'bg-white text-[#1C1917] shadow-sm' : 'text-[#78716C] hover:text-[#1C1917]'}`}>
                {mode === 'login' ? t('signIn') : t('register')}
              </button>
            ))}
          </div>

          <h2 className="mb-0.5 text-[21px] font-bold text-[#1C1917] md:text-[25px]">
            {tab === 'login' ? t('welcomeBack') : t('createAccount')}
          </h2>
          <p className="mb-3 text-[13px] text-[#78716C] md:mb-4 md:text-sm">
            {tab === 'login' ? t('existingAccount') : t('newAccount')}
          </p>

          <button type="button" onClick={() => void continueWithGoogle()} disabled={loading} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D6D3D1] bg-white py-2 text-sm font-bold text-[#1C1917] transition-colors hover:bg-[#FBF9F7] disabled:opacity-60 md:mb-4 md:py-2.5">
            <Chrome size={18} className="text-[#4285F4]" /> {t('continueGoogle')}
          </button>
          <div className="mb-3 flex items-center gap-3 text-xs text-[#A8A29E] md:mb-4"><span className="h-px flex-1 bg-[#EAE5E0]" />{t('emailSeparator')}<span className="h-px flex-1 bg-[#EAE5E0]" /></div>

          <form onSubmit={handleSubmit} className="space-y-2 md:space-y-3">
            {tab === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#57534E]">{t('fullName')}</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-[#EAE5E0] bg-white px-4 py-2 text-sm text-[#1C1917] focus:border-[#621E3E] focus:outline-none md:py-2.5" placeholder="Votre nom complet" />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#57534E]">Email</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-[#EAE5E0] bg-white px-4 py-2 text-sm text-[#1C1917] focus:border-[#621E3E] focus:outline-none md:py-2.5" placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#57534E]">{t('password')}</label>
              <input required minLength={6} type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full rounded-xl border border-[#EAE5E0] bg-white px-4 py-2 text-sm text-[#1C1917] focus:border-[#621E3E] focus:outline-none md:py-2.5" placeholder="Votre mot de passe" />
            </div>
            {tab === 'login' && (
              <div className="flex justify-end gap-3 pb-0.5 text-xs md:gap-4">
                <button type="button" onClick={() => void resendConfirmation()} disabled={loading} className="text-[#621E3E] font-semibold hover:underline disabled:opacity-60">Renvoyer confirmation</button>
                <button type="button" onClick={() => void sendPasswordReset()} disabled={loading} className="text-[#621E3E] font-semibold hover:underline disabled:opacity-60">{t('forgotPassword')}</button>
              </div>
            )}
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="text-sm text-[#667436]" role="status">{message}</p>}
            {tab === 'register' && confirmationEmail && (
              <button type="button" onClick={() => void resendConfirmation()} disabled={loading} className="w-full text-center text-xs font-semibold text-[#621E3E] hover:underline disabled:opacity-60">
                Renvoyer l’e-mail de confirmation
              </button>
            )}
            <button type="submit" disabled={loading} className="mt-1 w-full rounded-xl bg-[#621E3E] py-2 text-sm font-bold text-white transition-colors hover:bg-[#4e1830] disabled:opacity-60 md:mt-1.5 md:py-2.5">
              {loading ? t('wait') : tab === 'login' ? t('signIn') : t('create')}
            </button>
          </form>

          {resetStep === 'code' && (
            <form onSubmit={verifyResetCode} className="mt-6 space-y-3 rounded-2xl border border-[#C6C954]/50 bg-[#C6C954]/10 p-4">
              <div>
                <p className="text-sm font-bold text-[#1C1917]">Vérifier votre e-mail</p>
                <p className="mt-1 text-xs text-[#57534E]">Saisissez le code reçu sur {email.trim()}.</p>
              </div>
              <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={resetCode} onChange={event => setResetCode(event.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-[#D6D3D1] bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.35em] text-[#1C1917] outline-none focus:border-[#621E3E]" placeholder="00000000" />
              <button disabled={loading} type="submit" className="w-full rounded-xl bg-[#621E3E] py-3 text-sm font-bold text-white hover:bg-[#4e1830] disabled:opacity-60">{loading ? t('wait') : 'Vérifier le code'}</button>
            </form>
          )}

        </div>
      </div>
      <p className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap text-3xl font-extrabold tracking-tight text-white md:block">Discover. Match. Apply.</p>
    </div>
  );
}
