import React, { useState } from 'react';
import { ServiceContainer } from '@/services/container';
import { useAuth } from '@/hooks/useAuth';
import { useSortedLists } from '@/hooks/useSortedLists';
import DeleteConfirmationModal from '@/components/ui/DeleteConfirmationModal';
import ListItem from '@/components/ui/ListItem';
import { CreateListModal } from '@/components/ui/CreateListModal';

const HomePage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [listToDelete, setListToDelete] = useState<{
    name: string;
    uuid: string;
  } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);

  const { user } = useAuth();
  const { lists, isLoading, error: listsError } = useSortedLists();
  const serviceContainer = ServiceContainer.getInstance();
  const logger = serviceContainer.getLogService();
  const listController = serviceContainer.getListController();

  const handleDeleteClick = (list: { name: string; uuid: string }) => {
    setListToDelete(list);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listToDelete) return;

    try {
      setIsDeletingList(true);
      await listController.deleteList(listToDelete.uuid);
      setShowDeleteModal(false);
      setListToDelete(null);
      // The useSortedLists hook will automatically detect the deletion via events
    } catch (error) {
      logger.errorSync('Error deleting list:', error);
    } finally {
      setIsDeletingList(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setListToDelete(null);
  };

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 mb-2'>My Lists</h1>
          {user && (
            <p className='text-gray-600'>
              Welcome, {user.displayName || user.email}
            </p>
          )}
        </div>
        <div className='flex items-center gap-4'>
          <button
            onClick={() => setShowCreateModal(true)}
            className='btn btn-primary'
          >
            Create New List
          </button>
        </div>
      </div>

      {/* Create List Modal */}
      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title='Delete List'
        message={`Are you sure you want to delete "${listToDelete?.name || 'this list'}" and all its items? This action cannot be undone.`}
        isDeleting={isDeletingList}
      />

      {isLoading ? (
        <div className='text-center py-12'>
          <div className='text-gray-400 text-6xl mb-4'>⏳</div>
          <h2 className='text-xl font-medium text-gray-900 mb-2'>
            Loading lists...
          </h2>
          <p className='text-gray-600'>Please wait while we load your lists</p>
        </div>
      ) : listsError ? (
        <div className='text-center py-12'>
          <div className='text-red-400 text-6xl mb-4'>⚠️</div>
          <h2 className='text-xl font-medium text-gray-900 mb-2'>
            Error loading lists
          </h2>
          <p className='text-gray-600'>{listsError}</p>
        </div>
      ) : lists.length === 0 ? (
        <div className='text-center py-12'>
          <div className='text-gray-400 text-6xl mb-4'>📝</div>
          <h2 className='text-xl font-medium text-gray-900 mb-2'>
            No lists yet
          </h2>
          <p className='text-gray-600 mb-6'>
            Create your first list to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className='btn btn-primary'
          >
            Create Your First List
          </button>
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {lists.map(list => (
            <ListItem
              key={list.id}
              listId={list.id}
              onDeleteClick={handleDeleteClick}
              isOwner={user?.id === list.ownerId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;
