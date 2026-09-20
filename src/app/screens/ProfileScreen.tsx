import { useEffect, useState } from 'react';
import { Check, LogOut, User } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';
import type { ProfileData } from '../../types/profile';
import { supabase } from '../../lib/supabaseClient';
import { CompanyStatus, PageHeader } from '../components/shared';
import { userInitials } from '../utils';

export default function ProfileScreen() {
  const { profile, email, loading, saving, error, saveProfile } = useProfile();
  const [draft, setDraft] = useState<ProfileData>(profile);
  useEffect(() => setDraft(profile), [profile]);

  return (
    <div className="flex-1 overflow-auto bg-[#FBF9F7] p-8">
      <PageHeader title="Mon profil" sub="Votre nom est utilisé dans votre CV et vos candidatures." />
      {loading && <CompanyStatus loading error={null} />}
      {error && <CompanyStatus loading={false} error={error} />}

      <div className="max-w-xl rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#621E3E] text-lg font-extrabold text-white">
            {userInitials(draft.full_name, email)}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917]">{draft.full_name || 'Nom non renseigné'}</h2>
            <p className="mt-0.5 text-xs text-[#78716C]">{email}</p>
          </div>
        </div>

        <label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#57534E]"><User size={14} /> Nom complet</label>
        <input
          value={draft.full_name}
          onChange={event => setDraft(current => ({ ...current, full_name: event.target.value }))}
          placeholder="Votre nom complet"
          className="w-full rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] px-4 py-3 text-sm text-[#1C1917] outline-none focus:border-[#621E3E]"
        />
        <p className="mt-3 text-xs leading-relaxed text-[#78716C]">Les compétences, expériences et autres informations se remplissent uniquement dans le Studio CV.</p>

        <div className="mt-6 flex gap-3">
          <button onClick={() => void saveProfile(draft)} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#C6C954]/40 bg-[#C6C954]/20 py-2.5 text-xs font-bold text-[#4a4d1a] transition-colors hover:bg-[#C6C954]/30 disabled:opacity-60">
            <Check size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button onClick={() => void supabase.auth.signOut()} className="flex items-center justify-center gap-2 rounded-xl border border-[#EAE5E0] px-4 py-2.5 text-xs font-bold text-[#621E3E] transition-colors hover:bg-[#FBF9F7]">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}
