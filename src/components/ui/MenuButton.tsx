import React from 'react';

interface MenuButtonProps {
  onClick: () => void;
  icon?: string;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

const MenuButton: React.FC<MenuButtonProps> = ({
  onClick,
  icon,
  children,
  variant = 'default',
  disabled = false,
}) => {
  const baseClasses =
    'w-full text-left px-4 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    default: 'text-gray-700 hover:bg-gray-100',
    danger: 'text-red-600 hover:bg-red-50',
  };

  const classes = `${baseClasses} ${variantClasses[variant]}`;

  return (
    <button
      onClick={onClick}
      className={classes}
      disabled={disabled}
      type='button'
    >
      {icon && <span className='mr-2 inline-block w-4'>{icon}</span>}
      {children}
    </button>
  );
};

export default MenuButton;
