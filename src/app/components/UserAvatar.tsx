import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  name: string;
  className?: string;
}

export function UserAvatar({ avatarUrl, name, className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImg = avatarUrl && !imgError;

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <Avatar className={className}>
      {showImg && (
        <AvatarImage
          src={avatarUrl}
          alt=""
          onError={() => setImgError(true)}
        />
      )}
      <AvatarFallback className="bg-[#48A111] text-white text-sm">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
