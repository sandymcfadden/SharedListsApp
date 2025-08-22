import React, { useState, useEffect } from 'react';
import { ListInvite, CreateInviteRequest } from '@/types/List';
import { ServiceContainer } from '@/services/container';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listTitle: string;
}

const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  listId,
  listTitle,
}) => {
  const [invitationFor, setInvitationFor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [invites, setInvites] = useState<ListInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const serviceContainer = ServiceContainer.getInstance();
  const remoteStorage = serviceContainer.getRemoteStorageService();
  const logger = serviceContainer.getLogService();
  const authService = serviceContainer.getAuthService();

  // Load existing invites when modal opens
  useEffect(() => {
    if (isOpen) {
      loadInvites();
    }
  }, [isOpen, listId]);

  const loadInvites = async () => {
    try {
      setIsLoadingInvites(true);
      setError(null);

      // Get current user
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        setError('You must be logged in to view invites');
        return;
      }

      const invitesList = await remoteStorage.getListInvites(
        listId,
        currentUser.id
      );
      setInvites(invitesList);
    } catch (error) {
      logger.errorSync('Failed to load invites:', error);
      setError('Failed to load existing invites');
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      setIsCreating(true);
      setError(null);
      setSuccessMessage(null);

      // Get current user
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        setError('You must be logged in to generate invites');
        return;
      }

      const request: CreateInviteRequest = {
        listId,
        invitationFor: invitationFor.trim(),
      };

      const response = await remoteStorage.createInvite(
        request,
        currentUser.id
      );

      // Add the new invite to the list
      setInvites(prev => [response.invite, ...prev]);

      // Show success message with copy functionality
      setSuccessMessage(
        `Invite for ${invitationFor.trim()} generated! Share this link: ${response.inviteUrl}`
      );

      // Clear the input field
      setInvitationFor('');

      logger.infoSync('Invite generated successfully:', response);
    } catch (error) {
      logger.errorSync('Failed to generate invite:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to generate invite'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      // Get current user
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        setError('You must be logged in to revoke invites');
        return;
      }

      await remoteStorage.revokeInvite(inviteId, currentUser.id);
      setInvites(prev => prev.filter(invite => invite.id !== inviteId));
      setSuccessMessage('Invite revoked successfully');
      logger.infoSync('Invite revoked successfully:', inviteId);
    } catch (error) {
      logger.errorSync('Failed to revoke invite:', error);
      setError('Failed to revoke invite');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccessMessage('Link copied to clipboard!');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (error) {
      logger.errorSync('Failed to copy to clipboard:', error);
      setError('Failed to copy link');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'accepted':
        return 'text-green-600 bg-green-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden'>
        {/* Header */}
        <div className='px-6 py-4 border-b border-gray-200'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-semibold text-gray-900'>
              Manage Invites for "{listTitle}"
            </h2>
            <button
              onClick={onClose}
              className='text-gray-400 hover:text-gray-600 transition-colors'
            >
              <svg
                className='w-6 h-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]'>
          {/* Generate new invite */}
          <div className='mb-6'>
            <h3 className='text-lg font-medium text-gray-900 mb-3'>
              Generate New Invite
            </h3>
            <div className='flex gap-2'>
              <input
                type='text'
                placeholder='Who is this invite for? (e.g., John, Sarah, Team Lead)'
                value={invitationFor}
                onChange={e => setInvitationFor(e.target.value)}
                className='flex-1 input'
                disabled={isCreating}
              />
              <button
                onClick={handleGenerateInvite}
                disabled={!invitationFor.trim() || isCreating}
                className='btn btn-primary'
              >
                {isCreating ? 'Generating...' : 'Generate New Invite'}
              </button>
            </div>
          </div>

          {/* Error and success messages */}
          {error && (
            <div className='mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md'>
              {error}
            </div>
          )}
          {successMessage && (
            <div className='mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md'>
              {successMessage}
            </div>
          )}

          {/* Existing invites */}
          <div>
            <h3 className='text-lg font-medium text-gray-900 mb-3'>
              Invites by Person
            </h3>
            {isLoadingInvites ? (
              <div className='text-center py-4 text-gray-500'>
                Loading invites...
              </div>
            ) : invites.length === 0 ? (
              <div className='text-center py-4 text-gray-500'>
                No invites yet. Generate your first invite above!
              </div>
            ) : (
              <div className='space-y-3'>
                {invites.map(invite => (
                  <div
                    key={invite.id}
                    className='p-3 border border-gray-200 rounded-lg bg-gray-50'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <span className='font-medium text-gray-900'>
                        {invite.invitationFor}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          invite.status
                        )}`}
                      >
                        {invite.status}
                      </span>
                    </div>
                    <div className='text-sm text-gray-600 mb-2'>
                      Created: {formatDate(invite.createdAt)}
                      {invite.expiresAt && (
                        <span className='ml-4'>
                          Expires: {formatDate(invite.expiresAt)}
                        </span>
                      )}
                    </div>
                    <div className='flex gap-2'>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${window.location.origin}/manage/#/invite/${invite.token}`
                          )
                        }
                        className='btn btn-secondary text-sm'
                      >
                        Copy Link
                      </button>
                      {invite.status === 'pending' && (
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          className='btn btn-danger text-sm'
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className='px-6 py-4 border-t border-gray-200 bg-gray-50'>
          <div className='flex justify-end'>
            <button onClick={onClose} className='btn btn-secondary'>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
