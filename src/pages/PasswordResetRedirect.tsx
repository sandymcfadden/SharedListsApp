import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasRecoveryParams } from '@/utils/urlUtils';
import { useAuth } from '@/hooks/useAuth';

export function PasswordResetRedirect() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Check if we have recovery parameters in the URL
    if (hasRecoveryParams()) {
      // Redirect to the password reset page with the hash parameters preserved
      navigate('/reset-password', { replace: true });
    } else if (user) {
      // User is already authenticated, go to lists
      navigate('/lists', { replace: true });
    } else {
      // No recovery parameters and no user, redirect to auth page
      navigate('/auth', { replace: true });
    }
  }, [navigate, user]);

  return (
    <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
      <div className='text-center'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
        <p className='mt-4 text-gray-600'>Redirecting...</p>
      </div>
    </div>
  );
}
