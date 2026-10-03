import { useEffect, useState } from 'react';
import { Check, LogOut, User } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';
import type { ProfileData } from '../../types/profile';
import { supabase } from '../../lib/supabaseClient';
import { CompanyStatus, PageHeader } from '../components/shared';
import ProfileAvatar from '../components/ProfileAvatar';
import { profileAvatars, type ProfileAvatarChoice } from '../../lib/profileAvatar';

export default function ProfileScreen() {
  const { profile, email, loading, saving, error, saveProfile, avatarChoice, avatarSaving, avatarError, chooseAvatar } = useProfile();
  const [draft, setDraft] = useState<ProfileData>(profile);
  useEffect(() => setDraft(profile), [profile]);

  return (
    <div className="flex-1 overflow-auto bg-[#FBF9F7] p-8">
      <PageHeader title="Mon profil" sub="Votre nom est utilisé dans votre CV et vos candidatures." />
      {loading && <CompanyStatus loading error={null} />}
      {error && <CompanyStatus loading={false} error={error} />}

      <div className="max-w-xl rounded-2xl border border-[#EAE5E0] bg-white p-7 shadow-sm">
        <div className="mb-7 flex items-center gap-4">
          <ProfileAvatar choice={avatarChoice} name={draft.full_name} email={email} className="h-16 w-16 text-lg" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1C1917]">{draft.full_name || 'Nom non renseigné'}</h2>
            <p className="mt-0.5 break-all text-xs text-[#78716C]">{email}</p>
          </div>
        </div>

        {!loading && !avatarChoice && (
          <section aria-labelledby="profile-avatar-question" className="mb-7 rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-4">
            <h3 id="profile-avatar-question" className="text-sm font-bold text-[#1C1917]">Êtes-vous une fille ou un garçon ?</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#78716C]">Choisissez votre avatar. Ce choix sera enregistré et conservé pour vos prochaines connexions.</p>
            <div className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
              {(Object.keys(profileAvatars) as ProfileAvatarChoice[]).map(choice => (
                <button key={choice} type="button" onClick={() => void chooseAvatar(choice)} disabled={avatarSaving}
                  aria-label={`Choisir ${profileAvatars[choice].label}`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#EAE5E0] bg-white p-3 text-sm font-bold text-[#621E3E] transition-colors hover:border-[#621E3E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#621E3E] disabled:cursor-wait disabled:opacity-60">
                  <img src={profileAvatars[choice].src} alt="" className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24" />
                  {profileAvatars[choice].label}
                </button>
              ))}
            </div>
            {avatarSaving && <p role="status" className="mt-3 text-xs text-[#78716C]">Enregistrement de votre avatar…</p>}
            {avatarError && <p role="alert" className="mt-3 text-xs text-red-700">{avatarError}</p>}
          </section>
        )}

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
