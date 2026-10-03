import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { emptyProfile, type ProfileData } from '../types/profile';
import { persistProfileAvatar, readProfileAvatar, type ProfileAvatarChoice } from '../lib/profileAvatar';

const PROFILE_UPDATED_EVENT = 'marrakech-career-profile-updated';
const AVATAR_UPDATED_EVENT = 'marrakech-career-avatar-updated';

function profileFromRecord(record: Record<string, unknown> | null | undefined): ProfileData {
  if (!record) return emptyProfile;
  return {
    full_name: typeof record.full_name === 'string' ? record.full_name : '',
    job_title: typeof record.job_title === 'string' ? record.job_title : '',
    phone: typeof record.phone === 'string' ? record.phone : '',
    linkedin: typeof record.linkedin === 'string' ? record.linkedin : '',
    address: typeof record.address === 'string' ? record.address : '',
    education: typeof record.education === 'string' ? record.education : '',
    experience: typeof record.experience === 'string' ? record.experience : '',
    projects: typeof record.projects === 'string' ? record.projects : '',
    languages: typeof record.languages === 'string' ? record.languages : '',
    skills: typeof record.skills === 'string' ? record.skills : '',
  };
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarChoice, setAvatarChoice] = useState<ProfileAvatarChoice | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const currentUserId = useRef('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError(userError?.message ?? 'Utilisateur non connecté.');
        setLoading(false);
        return;
      }
      setEmail(userData.user.email ?? '');
      setUserId(userData.user.id);
      currentUserId.current = userData.user.id;
      setAvatarChoice(readProfileAvatar(userData.user.user_metadata));

      // 1. Fetch from 'profiles' table
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profileRow && !profileError) {
        setProfile(profileFromRecord(profileRow));
      } else {
        // Fallback to user_metadata if table row not yet created
        const metaProfile = profileFromRecord(userData.user.user_metadata as Record<string, unknown>);
        setProfile(metaProfile);

        // Auto-seed profile row if it doesn't exist
        if (userData.user.id) {
          void supabase.from('profiles').upsert({
            id: userData.user.id,
            ...metaProfile,
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Impossible de charger le profil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();

    const applyProfileUpdate = (event: Event) => {
      const nextProfile = (event as CustomEvent<ProfileData>).detail;
      if (nextProfile) setProfile(nextProfile);
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, applyProfileUpdate);
    const applyAvatarUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; choice: ProfileAvatarChoice }>).detail;
      if (detail?.userId === currentUserId.current) setAvatarChoice(detail.choice);
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, applyAvatarUpdate);
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = currentUserId.current;
      currentUserId.current = session?.user.id ?? '';
      setAvatarChoice(readProfileAvatar(session?.user.user_metadata));
      if (!session) {
        setProfile(emptyProfile);
        setEmail('');
        setUserId('');
      } else if (event === 'SIGNED_IN' && previousUserId !== session.user.id) {
        // Defer authenticated requests until the auth callback releases its lock.
        window.setTimeout(() => void loadProfile(), 0);
      }
    });
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, applyProfileUpdate);
      window.removeEventListener(AVATAR_UPDATED_EVENT, applyAvatarUpdate);
      authListener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const chooseAvatar = async (choice: ProfileAvatarChoice) => {
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const confirmedChoice = await persistProfileAvatar(supabase.auth, choice);
      setAvatarChoice(confirmedChoice);
      window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, {
        detail: { userId: currentUserId.current, choice: confirmedChoice },
      }));
      return true;
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Impossible d’enregistrer votre avatar.');
      return false;
    } finally {
      setAvatarSaving(false);
    }
  };

  const saveProfile = async (nextProfile: ProfileData) => {
    setSaving(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError('Utilisateur non connecté.');
        setSaving(false);
        return false;
      }

      // 1. Save in 'profiles' table
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userData.user.id,
          ...nextProfile,
          updated_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.error('Error saving to profiles table:', upsertError);
        setError(upsertError.message);
      }

      // 2. Also keep user_metadata updated as reliable backup
      await supabase.auth.updateUser({ data: nextProfile });

      setProfile(nextProfile);
      window.dispatchEvent(new CustomEvent<ProfileData>(PROFILE_UPDATED_EVENT, { detail: nextProfile }));
      setSaving(false);
      return !upsertError;
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Erreur lors de la sauvegarde du profil.');
      setSaving(false);
      return false;
    }
  };

  return { profile, email, userId, loading, saving, error, saveProfile, avatarChoice, avatarSaving, avatarError, chooseAvatar, refetch: loadProfile };
}
