import { useState } from 'react';
import { Check, LockKeyhole, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 6) { setError('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmation) { setError('Les deux mots de passe ne sont pas identiques.'); return; }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(`Impossible de modifier le mot de passe : ${updateError.message}`);
      setLoading(false);
      return;
    }
    window.history.replaceState({}, '', window.location.pathname);
    window.location.assign(window.location.origin);
  };

  return <div className="min-h-screen bg-[#FBF9F7] flex items-center justify-center p-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
    <div className="w-full max-w-md rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm">
      <div className="mb-7 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#621E3E]"><MapPin size={18} className="text-[#C6C954]" /></div><div><p className="text-sm font-extrabold text-[#1C1917]">Marrakech Career</p><p className="text-[10px] font-bold tracking-[0.2em] text-[#667436]">SÉCURITÉ DU COMPTE</p></div></div>
      </div>
      <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-[#C6C954]/20 text-[#4a4d1a]"><LockKeyhole size={20} /></div>
      <h1 className="text-xl font-bold text-[#1C1917]">Choisir un nouveau mot de passe</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#78716C]">Choisissez un mot de passe d’au moins 6 caractères pour sécuriser votre compte.</p>
      <form onSubmit={updatePassword} className="mt-6 space-y-4">
        <div><label className="mb-1.5 block text-xs font-semibold text-[#57534E]">Nouveau mot de passe</label><input autoFocus required minLength={6} type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-4 py-3 text-sm text-[#1C1917] outline-none focus:border-[#621E3E]" /></div>
        <div><label className="mb-1.5 block text-xs font-semibold text-[#57534E]">Confirmer le mot de passe</label><input required minLength={6} type="password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-4 py-3 text-sm text-[#1C1917] outline-none focus:border-[#621E3E]" /></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#621E3E] py-3 text-sm font-bold text-white transition-colors hover:bg-[#4e1830] disabled:opacity-60"><Check size={16} />{loading ? 'Modification…' : 'Enregistrer le nouveau mot de passe'}</button>
      </form>
    </div>
  </div>;
}
