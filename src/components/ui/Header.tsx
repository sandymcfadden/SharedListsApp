import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { CreateListModal } from '@/components/ui/CreateListModal';
import { EditProfileModal } from '@/components/ui/EditProfileModal';
import { UserAvatar, UserAvatarRef } from '@/components/ui/UserAvatar';

export function Header() {
  const { user, signOut } = useAuth();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const avatarRef = useRef<UserAvatarRef>(null);

  // Handle scroll-based header visibility
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down and past the top 100px
        setIsHeaderVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY]);

  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const closeProfileDropdown = () => {
    setShowProfileDropdown(false);
  };

  const openCreateListModal = () => {
    setShowCreateListModal(true);
  };

  const closeCreateListModal = () => {
    setShowCreateListModal(false);
  };

  const openEditProfileModal = () => {
    setShowEditProfileModal(true);
    closeProfileDropdown();
  };

  const closeEditProfileModal = () => {
    setShowEditProfileModal(false);
  };

  const handleProfileUpdateSuccess = (newDisplayName: string) => {
    // Update the avatar immediately with the new display name
    if (avatarRef.current) {
      avatarRef.current.setDisplayName(newDisplayName);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      closeProfileDropdown();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50 transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className='container mx-auto px-4'>
          <div className='flex items-center justify-between h-16'>
            {/* Left side - App Logo */}
            <Link
              to='/'
              className='flex items-center space-x-2 hover:opacity-80 transition-opacity'
            >
              <div className='w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
                  />
                </svg>
              </div>
              <span className='text-xl font-semibold text-gray-900'>
                Shared Lists
              </span>
            </Link>

            {/* Right side - User Controls */}
            <div className='flex items-center space-x-3'>
              {/* New List Button - Only show when authenticated */}
              {user && (
                <button
                  onClick={openCreateListModal}
                  className='w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors'
                  title='Create New List'
                >
                  <svg
                    className='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 4v16m8-8H4'
                    />
                  </svg>
                </button>
              )}

              {/* User Avatar - Only show when authenticated */}
              {user ? (
                <div className='relative'>
                  <UserAvatar
                    ref={avatarRef}
                    user={user}
                    onClick={toggleProfileDropdown}
                  />

                  {/* Profile Dropdown */}
                  {showProfileDropdown && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className='fixed inset-0 z-40'
                        onClick={closeProfileDropdown}
                      />

                      {/* Dropdown Menu */}
                      <div className='absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50'>
                        <div className='py-1'>
                          <button
                            onClick={openEditProfileModal}
                            className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                          >
                            Edit Profile
                          </button>
                          <button
                            onClick={handleSignOut}
                            className='block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors'
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Sign In Link - Only show when not authenticated */
                <Link
                  to='/auth'
                  className='px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors'
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Create List Modal */}
      <CreateListModal
        isOpen={showCreateListModal}
        onClose={closeCreateListModal}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={closeEditProfileModal}
        onSuccess={handleProfileUpdateSuccess}
      />
    </>
  );
}
