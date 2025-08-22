import { useState, forwardRef, useImperativeHandle } from 'react';

interface UserAvatarProps {
  user: {
    id: string;
    displayName?: string;
  } | null;
  onClick?: () => void;
}

export interface UserAvatarRef {
  setDisplayName: (displayName: string) => void;
}

export const UserAvatar = forwardRef<UserAvatarRef, UserAvatarProps>(
  ({ user, onClick }, ref) => {
    const [displayName, setDisplayName] = useState(user?.displayName || '');

    // Expose setDisplayName function to parent components
    useImperativeHandle(ref, () => ({
      setDisplayName: (newDisplayName: string) => {
        setDisplayName(newDisplayName);
      },
    }));

    const getInitials = (name?: string) => {
      if (!name) return '?';
      return name
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    if (!user) return null;

    return (
      <button
        onClick={onClick}
        className='w-8 h-8 bg-gray-600 hover:bg-gray-700 text-white rounded-full flex items-center justify-center text-sm font-medium transition-colors'
      >
        {getInitials(displayName)}
      </button>
    );
  }
);

UserAvatar.displayName = 'UserAvatar';
