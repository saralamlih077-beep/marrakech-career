import { profileAvatars, type ProfileAvatarChoice } from '../../lib/profileAvatar';
import { userInitials } from '../utils';

export default function ProfileAvatar({ choice, name, email, isAdmin = false, className = '' }: {
  choice: ProfileAvatarChoice | null; name: string; email: string; isAdmin?: boolean; className?: string;
}) {
  const imageSrc = isAdmin ? '/avatars/admin.png' : choice ? profileAvatars[choice].src : null;
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#621E3E] font-extrabold text-white ${className}`}>
      {imageSrc
        ? <img src={imageSrc} alt={isAdmin ? 'Avatar administrateur' : 'Avatar du profil'} className="h-full w-full object-cover" />
        : userInitials(name, email)}
    </div>
  );
}
