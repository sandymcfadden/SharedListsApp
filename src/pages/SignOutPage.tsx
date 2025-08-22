import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SignOutPage() {
  const [showSignInButton, setShowSignInButton] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Show the sign-in button after a brief delay
    const timer = setTimeout(() => {
      setShowSignInButton(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
      <div className='sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='text-center'>
          <div className='text-green-500 text-6xl mb-4'>✅</div>
          <h1 className='text-3xl font-extrabold text-gray-900 mb-2'>
            Signed Out Successfully
          </h1>
          <p className='text-gray-600 mb-8'>
            You have been signed out of your account. All your data has been
            cleared from this device.
          </p>
        </div>
      </div>

      <div className='sm:mx-auto sm:w-full sm:max-w-md'>
        <div className='bg-white py-8 px-6 shadow rounded-lg'>
          <div className='text-center space-y-4'>
            {!showSignInButton ? (
              <div className='text-sm text-gray-500'>
                <div className='animate-pulse'>Clearing data...</div>
              </div>
            ) : (
              <>
                <p className='text-sm text-gray-600'>
                  Ready to get back to your lists?
                </p>
                <button
                  onClick={() => {
                    navigate('/auth');
                  }}
                  className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200'
                >
                  Sign In Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
