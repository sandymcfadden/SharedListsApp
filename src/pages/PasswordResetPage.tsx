import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PasswordRecoveryForm } from '@/components/auth/PasswordRecoveryForm';
import { useAuth } from '@/hooks/useAuth';
import { hasRecoveryParams } from '@/utils/urlUtils';

export function PasswordResetPage() {
  const navigate = useNavigate();
  const { resetPassword, clearRecoverySession, loading, error, clearError } =
    useAuth();
  const [isValidSession, setIsValidSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Check if there are valid recovery parameters in the URL
    if (hasRecoveryParams()) {
      setIsValidSession(true);
    } else {
      setIsValidSession(false);
    }

    setIsLoading(false);
  }, []);

  const handleSuccess = () => {
    // Clear recovery session and redirect to main app
    clearRecoverySession();
    navigate('/lists');
  };

  const handleCancel = () => {
    // Clear recovery session and redirect to auth page
    clearRecoverySession();
    navigate('/auth', { replace: true });
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await resetPassword(email);
      setRequestSent(true);
    } catch (_error) {
      // Error is handled by the useAuth hook
    }
  };

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600'>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='max-w-md mx-auto p-6 bg-white rounded-lg shadow-md'>
          <h1 className='text-2xl font-bold text-center mb-6'>
            Request Password Reset
          </h1>

          {error && (
            <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
              {error}
            </div>
          )}

          {requestSent ? (
            <div className='text-center'>
              <div className='mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded'>
                Password reset email sent! Check your inbox and follow the
                instructions to reset your password.
              </div>
              <button
                onClick={() => navigate('/auth')}
                className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleRequestReset} className='space-y-4'>
              <div>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  Email
                </label>
                <input
                  type='email'
                  id='email'
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Enter your email'
                  autoFocus
                />
              </div>

              <button
                type='submit'
                disabled={loading}
                className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>

              <div className='text-center'>
                <button
                  type='button'
                  onClick={() => navigate('/auth')}
                  className='text-blue-600 hover:text-blue-500 font-medium'
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
      <div className='sm:mx-auto sm:w-full sm:max-w-md'>
        <h1 className='text-center text-3xl font-extrabold text-gray-900 mb-2'>
          SharedListsApp
        </h1>
        <p className='text-center text-gray-600'>Reset your password</p>
      </div>

      <div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
        <PasswordRecoveryForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
