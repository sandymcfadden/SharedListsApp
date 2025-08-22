import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface PasswordRecoveryFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PasswordRecoveryForm({
  onSuccess,
  onCancel,
}: PasswordRecoveryFormProps) {
  const { updatePassword, loading, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.newPassword.length < 6) {
      setValidationError('Password must be at least 6 characters long');
      return;
    }

    try {
      await updatePassword(formData.newPassword);
      onSuccess?.();
    } catch (_error) {
      // Error is handled by the useAuth hook
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className='max-w-md mx-auto p-6 bg-white rounded-lg shadow-md'>
      <h2 className='text-2xl font-bold text-center mb-6'>Set New Password</h2>

      <p className='text-center text-gray-600 mb-6'>
        Please enter your new password below.
      </p>

      {(error || validationError) && (
        <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
          {error || validationError}
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label
            htmlFor='newPassword'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            New Password
          </label>
          <input
            type='password'
            id='newPassword'
            name='newPassword'
            value={formData.newPassword}
            onChange={handleInputChange}
            required
            minLength={6}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter your new password'
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor='confirmPassword'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Confirm New Password
          </label>
          <input
            type='password'
            id='confirmPassword'
            name='confirmPassword'
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            minLength={6}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Confirm your new password'
          />
        </div>

        <button
          type='submit'
          disabled={loading}
          className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        {onCancel && (
          <div className='text-center'>
            <button
              type='button'
              onClick={onCancel}
              className='text-blue-600 hover:text-blue-500 font-medium'
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
