import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface ListEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => Promise<void>;
  currentTitle: string;
  currentDescription?: string;
  isSaving?: boolean;
}

const ListEditModal: React.FC<ListEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentTitle,
  currentDescription = '',
  isSaving = false,
}) => {
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);

  // Update form when modal opens with new values
  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle);
      setDescription(currentDescription || '');
    }
  }, [isOpen, currentTitle, currentDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      await onSave(title.trim(), description.trim());
      onClose();
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setTitle(currentTitle);
    setDescription(currentDescription || '');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title='Edit List'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label
            htmlFor='title'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Title *
          </label>
          <input
            type='text'
            id='title'
            value={title}
            onChange={e => setTitle(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter list title'
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label
            htmlFor='description'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            Description
          </label>
          <textarea
            id='description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='Enter list description (optional)'
            disabled={isSaving}
          />
        </div>

        <div className='flex justify-end space-x-3 pt-4'>
          <button
            type='button'
            onClick={handleCancel}
            className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50'
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type='submit'
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50'
            disabled={isSaving || !title.trim()}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ListEditModal;
