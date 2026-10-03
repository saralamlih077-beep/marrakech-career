import { profileAvatars, type ProfileAvatarChoice } from '../../lib/profileAvatar';
import { userInitials } from '../utils';

export default function ProfileAvatar({ choice, name, email, className = '' }: {
  choice: ProfileAvatarChoice | null; name: string; email: string; className?: string;
}) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#621E3E] font-extrabold text-white ${className}`}>
      {choice
        ? <img src={profileAvatars[choice].src} alt="Avatar du profil" className="h-full w-full object-cover" />
        : userInitials(name, email)}
    </div>
  );
}
