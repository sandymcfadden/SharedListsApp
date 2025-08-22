import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ServiceContainer } from '@/services/container';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ListInvite } from '@/types/List';

const InviteAcceptancePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<ListInvite | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const serviceContainer = ServiceContainer.getInstance();
  const logger = serviceContainer.getLogService();
  const remoteStorage = serviceContainer.getRemoteStorageService();
  const listController = serviceContainer.getListController();

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setIsLoading(false);
      return;
    }

    loadInvite();
  }, [token]);

  const loadInvite = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const inviteData = await remoteStorage.getInviteByToken(token!);
      setInvite(inviteData);
      setIsLoading(false);
    } catch (err) {
      logger.errorSync('Failed to load invite:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load invite details'
      );
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user || !invite) return;

    try {
      setIsAccepting(true);
      setError(null);

      // Accept the invite
      await remoteStorage.acceptInvite(invite.token);

      setSuccess('Invite accepted successfully! Setting up list...');

      // Bootstrap from remote to get all the data we need
      try {
        setSuccess('Setting up list data...');

        // Run bootstrap to fetch all lists and updates from remote
        await listController.bootstrapFromRemote();

        setSuccess('List ready! Redirecting...');

        // Redirect to the list after a short delay
        setTimeout(() => {
          navigate(`/list/${invite.yjsDocumentId}`);
        }, 1500);
      } catch (listError) {
        logger.errorSync('Failed to bootstrap list data:', listError);
        // Still redirect even if bootstrap fails - the list page will handle it
        setSuccess('Invite accepted! Redirecting...');
        setTimeout(() => {
          navigate(`/list/${invite.yjsDocumentId}`);
        }, 1500);
      }
    } catch (err) {
      logger.errorSync('Failed to accept invite:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
      setIsAccepting(false);
    }
  };

  const handleSignIn = () => {
    navigate('/auth');
  };

  if (authLoading || isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <LoadingSpinner message='Loading invite...' />
      </div>
    );
  }

  // If user is not authenticated, show sign in message
  if (!user) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold text-gray-900 mb-2'>
              Sign In Required
            </h1>
            <p className='text-gray-600'>
              You need to sign in or create an account to accept this invite.
            </p>
          </div>

          <div className='space-y-4'>
            <button
              onClick={handleSignIn}
              className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors'
            >
              Sign In / Sign Up
            </button>

            <p className='text-sm text-gray-500'>
              After signing in, you'll be able to accept the invite and join the
              list.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If there's an error loading the invite
  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center'>
          <div className='mb-6'>
            <h1 className='text-2xl font-bold text-red-600 mb-2'>
              Invalid Invite
            </h1>
            <p className='text-gray-600'>{error}</p>
          </div>

          <button
            onClick={() => navigate('/lists')}
            className='bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors'
          >
            Go to Lists
          </button>
        </div>
      </div>
    );
  }

  // If invite is loaded successfully
  if (invite) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='max-w-md w-full bg-white rounded-lg shadow-md p-8'>
          <div className='mb-6 text-center'>
            <h1 className='text-2xl font-bold text-gray-900 mb-2'>
              Accept Invite
            </h1>
            <p className='text-gray-600'>You've been invited to join a list</p>
          </div>

          <div className='mb-6 space-y-4'>
            <div className='bg-gray-50 p-4 rounded-md'>
              <h3 className='font-semibold text-gray-900 mb-2'>
                Invite Details
              </h3>
              <div className='space-y-2 text-sm'>
                <div>
                  <span className='font-medium text-gray-700'>For:</span>{' '}
                  {invite.invitationFor}
                </div>
                <div>
                  <span className='font-medium text-gray-700'>Status:</span>
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs ${
                      invite.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : invite.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {invite.status}
                  </span>
                </div>
                <div>
                  <span className='font-medium text-gray-700'>Expires:</span>{' '}
                  {invite.expiresAt.toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {success ? (
            <div className='mb-4 p-4 bg-green-100 text-green-800 rounded-md text-center'>
              {success}
            </div>
          ) : (
            <div className='space-y-4'>
              <button
                onClick={handleAcceptInvite}
                disabled={isAccepting || invite.status !== 'pending'}
                className={`w-full py-2 px-4 rounded-md transition-colors ${
                  invite.status === 'pending' && !isAccepting
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isAccepting ? 'Accepting...' : 'Accept Invite'}
              </button>

              {invite.status !== 'pending' && (
                <p className='text-sm text-gray-500 text-center'>
                  This invite has already been{' '}
                  {invite.status === 'accepted' ? 'accepted' : 'expired'}.
                </p>
              )}
            </div>
          )}

          <div className='mt-6 text-center'>
            <button
              onClick={() => navigate('/lists')}
              className='text-gray-600 hover:text-gray-800 transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50'>
      <div className='max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center'>
        <h1 className='text-2xl font-bold text-gray-900 mb-4'>
          Loading Invite...
        </h1>
        <LoadingSpinner message='Please wait...' />
      </div>
    </div>
  );
};

export default InviteAcceptancePage;
