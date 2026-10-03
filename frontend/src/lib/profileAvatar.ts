import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileAvatarChoice = 'girl' | 'boy';

export const profileAvatars = {
  girl: { label: 'Fille', src: '/avatars/fille.png' },
  boy: { label: 'Garçon', src: '/avatars/garcon.png' },
} as const;

export function readProfileAvatar(metadata: Record<string, unknown> | null | undefined): ProfileAvatarChoice | null {
  const choice = metadata?.profile_avatar;
  return choice === 'girl' || choice === 'boy' ? choice : null;
}

// Store the choice on the authenticated account, independently of CV/profile edits.
export async function persistProfileAvatar(
  auth: Pick<SupabaseClient['auth'], 'getUser' | 'updateUser'>,
  choice: ProfileAvatarChoice,
): Promise<ProfileAvatarChoice> {
  if (choice !== 'girl' && choice !== 'boy') throw new Error('Choisissez Fille ou Garçon.');
  const { data, error } = await auth.getUser();
  if (error || !data.user) throw new Error('Reconnectez-vous pour enregistrer votre avatar.');
  const savedChoice = readProfileAvatar(data.user.user_metadata);
  if (savedChoice) return savedChoice;
  const result = await auth.updateUser({ data: { profile_avatar: choice } });
  if (result.error) throw new Error('Votre avatar n’a pas été enregistré. Réessayez.');
  const confirmedChoice = readProfileAvatar(result.data.user?.user_metadata);
  if (!confirmedChoice) throw new Error('Votre avatar n’a pas été enregistré. Réessayez.');
  return confirmedChoice;
}
