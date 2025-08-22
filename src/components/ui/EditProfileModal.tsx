import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Modal from '@/components/ui/Modal';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newDisplayName: string) => void;
}

export function EditProfileModal({
  isOpen,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user?.displayName]);

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setIsUpdating(true);
      setError(null);

      await updateProfile({
        displayName: displayName.trim() || undefined,
      });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(displayName.trim());
      }

      // Close modal
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to update profile'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setDisplayName(user?.displayName || '');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Edit Profile'>
      <div className='space-y-4'>
        {error && (
          <div className='p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor='displayName'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Display Name
          </label>
          <input
            id='displayName'
            type='text'
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder='Enter your display name'
            className='input'
            autoFocus
          />
          <p className='text-sm text-gray-500 mt-1'>
            This name will be displayed in the header and shared lists
          </p>
        </div>

        <div className='flex gap-2 justify-end'>
          <button onClick={handleClose} className='btn btn-secondary'>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUpdating}
            className='btn btn-primary'
          >
            {isUpdating ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
