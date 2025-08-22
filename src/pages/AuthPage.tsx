import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { ServiceContainer } from '@/services/container';

export function AuthPage() {
  const navigate = useNavigate();

  // Attempt to clean up any leftover databases when the auth page loads
  useEffect(() => {
    const cleanupLeftoverDatabases = async () => {
      try {
        console.log(
          'Attempting to clean up leftover databases on auth page load...'
        );

        // Get the service container and try to clear any leftover data
        const serviceContainer = ServiceContainer.getInstance();
        await serviceContainer.cleanupLeftoverDatabases();
      } catch (error) {
        console.log('Error during database cleanup on auth page load:', error);
        // Don't throw - this is just cleanup, not critical
      }
    };

    // Run cleanup after a short delay to ensure page is fully loaded
    const timeoutId = setTimeout(cleanupLeftoverDatabases, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleSuccess = () => {
    // Redirect to the main app after successful authentication
    navigate('/lists');
  };

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
      <div className='sm:mx-auto sm:w-full sm:max-w-md'>
        <h1 className='text-center text-3xl font-extrabold text-gray-900 mb-2'>
          Shared Lists App
        </h1>
        <p className='text-center text-gray-600'>
          Collaborative lists for families and teams
        </p>
      </div>

      <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
        <AuthForm onSuccess={handleSuccess} />

        <div className='mt-6 text-center'>
          <p className='text-sm text-gray-600'>
            This is an invite-only system. Need access?{' '}
            <a
              href='mailto:sandymc@gmail.com'
              className='font-medium text-blue-600 hover:text-blue-500'
            >
              Request an invite
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
