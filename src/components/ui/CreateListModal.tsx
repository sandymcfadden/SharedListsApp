import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceContainer } from '@/services/container';
import Modal from './Modal';

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateListModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateListModalProps) {
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const navigate = useNavigate();

  const serviceContainer = ServiceContainer.getInstance();
  const logger = serviceContainer.getLogService();
  const listController = serviceContainer.getListController();

  const handleSubmit = async () => {
    if (newListName.trim()) {
      try {
        setIsCreatingList(true);
        const listId = await listController.createList(
          newListName.trim(),
          newListDescription.trim() || undefined
        );

        // Reset form
        setNewListName('');
        setNewListDescription('');

        // Close modal
        onClose();

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }

        logger.infoSync('List created successfully from header');

        // Navigate to the newly created list
        navigate(`/list/${listId}`);
      } catch (error) {
        logger.errorSync('Error creating list from header:', error);
        // You could add error handling UI here if needed
      } finally {
        setIsCreatingList(false);
      }
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setNewListName('');
    setNewListDescription('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title='Create New List'>
      <div className='space-y-4'>
        <div>
          <label
            htmlFor='listName'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            List Name
          </label>
          <input
            id='listName'
            type='text'
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder='Enter list name...'
            className='input'
            autoFocus
          />
        </div>
        <div>
          <label
            htmlFor='listDescription'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Description (Optional)
          </label>
          <textarea
            id='listDescription'
            value={newListDescription}
            onChange={e => setNewListDescription(e.target.value)}
            placeholder='Enter list description...'
            className='input min-h-[80px] resize-none'
            rows={3}
          />
        </div>
        <div className='flex gap-2 justify-end'>
          <button onClick={handleClose} className='btn btn-secondary'>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newListName.trim() || isCreatingList}
            className='btn btn-primary'
          >
            {isCreatingList ? 'Creating...' : 'Create List'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
