import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useList } from '@/hooks/useList';
import { useAuth } from '@/hooks/useAuth';

import { CollaborativeListItem } from '@/types/List';
import DeleteConfirmationModal from '@/components/ui/DeleteConfirmationModal';
import { ProgressIndicator } from '@/components/ui/ProgressIndicator';
import { DraggableItemList } from '@/components/ui/DraggableItemList';
import ListEditModal from '@/components/ui/ListEditModal';
import InviteModal from '@/components/ui/InviteModal';
import MenuButton from '@/components/ui/MenuButton';
import { ServiceContainer } from '@/services/container';

const ListPage: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [newItemText, setNewItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] =
    useState<CollaborativeListItem | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditingList, setIsEditingList] = useState(false);
  const [showDeleteListModal, setShowDeleteListModal] = useState(false);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [showClearCompletedModal, setShowClearCompletedModal] = useState(false);
  const [isClearingCompleted, setIsClearingCompleted] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveListModal, setShowLeaveListModal] = useState(false);
  const [isLeavingList, setIsLeavingList] = useState(false);

  const serviceContainer = ServiceContainer.getInstance();
  const logger = serviceContainer.getLogService();
  const menuRef = useRef<HTMLDivElement>(null);

  // Refs for focus preservation
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const editingInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Get current user for ownership checks
  const { user } = useAuth();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Track which input was last focused to preserve focus during re-renders
  const [lastFocusedInput, setLastFocusedInput] = useState<
    'newItem' | string | null
  >(null);

  // Load the list using our new hook
  const {
    document: listDocument,
    isLoading,
    error,
    wasDeletedRemotely,
    // Individual operation loading states
    isAddingItem,
    isDeletingItem,
    // Operations
    addItem,
    updateItem,
    deleteItem,
    toggleItem,
    moveItem,
    editListMetadata,
    deleteList,
    leaveList,
    clearCompletedItems,
  } = useList(listId || '');

  // Handle focus events to track which input was last focused
  const handleNewItemFocus = () => {
    setLastFocusedInput('newItem');
  };

  const handleEditItemFocus = (itemId: string) => {
    setLastFocusedInput(itemId);
  };

  const handleStartEdit = (item: CollaborativeListItem) => {
    setEditingItemId(item.id);
    setEditText(item.content);
  };

  const handleSaveEdit = async () => {
    if (editingItemId && editText.trim() !== '') {
      try {
        await updateItem(editingItemId, { content: editText.trim() });
        setEditingItemId(null);
        setEditText('');
      } catch (error) {
        // Error is already handled by the hook with optimistic rollback
        logger.errorSync('Failed to update item:', error);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditText('');
  };

  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteClick = (item: CollaborativeListItem) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const title = listDocument?.title || 'Untitled List';
  const items = useMemo(() => listDocument?.items || [], [listDocument?.items]);

  // Focus preservation effect - restore focus after re-renders
  useEffect(() => {
    // Restore focus to new item input if it was the last focused input
    if (
      lastFocusedInput === 'newItem' &&
      newItemInputRef.current &&
      document.activeElement !== newItemInputRef.current
    ) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        newItemInputRef.current?.focus();
      }, 0);
    }

    // Restore focus to editing input if it was the last focused input
    if (
      lastFocusedInput &&
      lastFocusedInput !== 'newItem' &&
      editingInputRefs.current.has(lastFocusedInput)
    ) {
      const editingInput = editingInputRefs.current.get(lastFocusedInput);
      if (editingInput && document.activeElement !== editingInput) {
        setTimeout(() => {
          editingInput.focus();
        }, 0);
      }
    }
  }, [items, lastFocusedInput]); // Re-run when list data changes

  if (!listId) {
    return <div>List ID is required</div>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <ProgressIndicator completedItems={0} totalItems={0} />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h2 className='text-xl font-semibold text-red-600 mb-2'>
            Error Loading List
          </h2>
          <p className='text-gray-600'>{error}</p>
        </div>
      </div>
    );
  }

  // Show deleted state
  if (wasDeletedRemotely) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h2 className='text-xl font-semibold text-red-600 mb-2'>
            List Deleted
          </h2>
          <p className='text-gray-600 mb-4'>
            This list was deleted by another user.
          </p>
          <button
            onClick={() => navigate('/lists')}
            className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
          >
            Back to Lists
          </button>
        </div>
      </div>
    );
  }

  // Check if current user is the owner of the list
  const isOwner = user?.id === listDocument?.ownerId;

  const handleAddItem = async () => {
    if (newItemText.trim()) {
      try {
        await addItem(newItemText.trim());
        setNewItemText('');
      } catch (error) {
        // Error is already handled by the hook with optimistic rollback
        logger.errorSync('Failed to add item:', error);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      await deleteItem(itemToDelete.id);
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      // Error is already handled by the hook with optimistic rollback
      logger.errorSync('Error deleting item:', error);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const handleReorderItems = async (newItems: CollaborativeListItem[]) => {
    // Find the item that moved by comparing with the original order
    const originalItems = listDocument?.items || [];

    for (let i = 0; i < newItems.length; i++) {
      if (originalItems[i]?.id !== newItems[i].id) {
        // Found the moved item
        const movedItem = newItems[i];
        try {
          await moveItem(movedItem.id, i);
        } catch (error) {
          // Error is already handled by the hook with optimistic rollback
          logger.errorSync('Error moving item:', error);
        }
        break;
      }
    }
  };

  const goBack = () => {
    navigate('/lists');
  };

  const handleEditList = () => {
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleSaveListEdit = async (title: string, description: string) => {
    try {
      setIsEditingList(true);

      // Update title and description in a single call
      await editListMetadata({ title, description });

      logger.infoSync('List updated successfully');
    } catch (error) {
      logger.errorSync('Failed to update list:', error);
      // Error is already handled by the hook with optimistic rollback
    } finally {
      setIsEditingList(false);
    }
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleDeleteList = () => {
    setShowDeleteListModal(true);
    setShowMenu(false);
  };

  const handleDeleteListConfirm = async () => {
    try {
      setIsDeletingList(true);
      await deleteList();
      // After successful deletion, redirect to lists page
      navigate('/lists');
    } catch (error) {
      logger.errorSync('Failed to delete list:', error);
      // Error is already handled by the hook
    } finally {
      setIsDeletingList(false);
      setShowDeleteListModal(false);
    }
  };

  const handleDeleteListCancel = () => {
    setShowDeleteListModal(false);
  };

  const handleClearCompleted = () => {
    setShowClearCompletedModal(true);
    setShowMenu(false);
  };

  const handleClearCompletedConfirm = async () => {
    try {
      setIsClearingCompleted(true);
      await clearCompletedItems();
      logger.infoSync('Completed items cleared successfully');
    } catch (error) {
      logger.errorSync('Failed to clear completed items:', error);
      // Error is already handled by the hook
    } finally {
      setIsClearingCompleted(false);
      setShowClearCompletedModal(false);
    }
  };

  const handleClearCompletedCancel = () => {
    setShowClearCompletedModal(false);
  };

  const handleManageInvites = () => {
    setShowInviteModal(true);
    setShowMenu(false);
  };

  const handleLeaveList = () => {
    setShowLeaveListModal(true);
    setShowMenu(false);
  };

  const handleLeaveListConfirm = async () => {
    try {
      setIsLeavingList(true);
      await leaveList();
      // After successful leave, redirect to lists page
      navigate('/lists');
    } catch (error) {
      logger.errorSync('Failed to leave list:', error);
      // Error is already handled by the hook
    } finally {
      setIsLeavingList(false);
      setShowLeaveListModal(false);
    }
  };

  const handleLeaveListCancel = () => {
    setShowLeaveListModal(false);
  };

  return (
    <div className='max-w-4xl mx-auto'>
      {/* Header */}
      <div className='mb-6'>
        <div className='flex items-center mb-2'>
          <button
            onClick={goBack}
            className='btn btn-secondary mr-4'
            aria-label='Back to lists'
          >
            ←
          </button>
          <h1 className='text-2xl font-bold text-gray-900'>{title}</h1>

          {/* Menu Button */}
          <div className='relative ml-auto' ref={menuRef}>
            <button
              onClick={toggleMenu}
              className='p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors'
              title='List options'
            >
              <svg
                className='w-5 h-5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z'
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className='absolute right-0 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10'>
                <MenuButton onClick={handleEditList} icon='✏️'>
                  Edit List
                </MenuButton>
                <MenuButton onClick={handleClearCompleted} icon='🧹'>
                  Clear Completed
                </MenuButton>

                {/* Only show invite management to list owners */}
                {isOwner && (
                  <MenuButton onClick={handleManageInvites} icon='👥'>
                    Manage Invites
                  </MenuButton>
                )}

                {/* Show leave list option to non-owners */}
                {!isOwner && (
                  <>
                    {/* Separator */}
                    <div className='border-t border-gray-200'></div>

                    <MenuButton
                      onClick={handleLeaveList}
                      icon='🚪'
                      variant='danger'
                    >
                      Leave List
                    </MenuButton>
                  </>
                )}

                {/* Only show delete option to list owners */}
                {isOwner && (
                  <>
                    {/* Separator */}
                    <div className='border-t border-gray-200'></div>

                    <MenuButton
                      onClick={handleDeleteList}
                      icon='🗑️'
                      variant='danger'
                    >
                      Delete List
                    </MenuButton>
                  </>
                )}
                {/* Add more menu items here in the future */}
              </div>
            )}
          </div>
        </div>
        {listDocument?.description && (
          <p className='text-gray-600 ml-16'>{listDocument.description}</p>
        )}
      </div>

      {items.length > 0 && (
        <div className='mt-4'>
          <ProgressIndicator
            completedItems={items.filter(item => item.isCompleted).length}
            totalItems={items.length}
            showLabel={true}
            showProgressBar={true}
            className='text-center'
          />
        </div>
      )}

      {/* Add new item */}
      <div className='bg-white rounded-lg border border-gray-200 p-4 my-6'>
        <div className='flex gap-2'>
          <input
            ref={newItemInputRef}
            type='text'
            value={newItemText}
            onChange={e => setNewItemText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            onFocus={handleNewItemFocus}
            placeholder='Add a new item...'
            className='input flex-1'
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemText.trim() || isAddingItem}
            className='btn btn-primary'
          >
            {isAddingItem ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className='bg-white rounded-lg border border-gray-200'>
        {items.length === 0 ? (
          <div className='p-8 text-center text-gray-500'>
            No items yet. Add your first item above!
          </div>
        ) : (
          <DraggableItemList
            items={items}
            onReorder={handleReorderItems}
            keyExtractor={item => item.id}
            className='divide-y divide-gray-200'
            itemClassName=''
            renderItem={(item, _index, _isDragging, dragHandleProps) => (
              <div className='flex items-center gap-3 p-4'>
                {/* Drag handle */}
                <div
                  {...dragHandleProps.attributes}
                  {...dragHandleProps.listeners}
                  className='cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1'
                  title='Drag to reorder'
                >
                  ⋮⋮
                </div>

                <input
                  type='checkbox'
                  checked={item.isCompleted}
                  onChange={() => toggleItem(item.id)}
                  className='w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500'
                />
                <div className='flex-1'>
                  {editingItemId === item.id ? (
                    <div className='flex gap-2'>
                      <input
                        ref={el => {
                          if (el) {
                            editingInputRefs.current.set(item.id, el);
                          } else {
                            editingInputRefs.current.delete(item.id);
                          }
                        }}
                        type='text'
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={handleEditKeyPress}
                        onFocus={() => handleEditItemFocus(item.id)}
                        className='flex-1 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        autoFocus
                      />
                      <button
                        onClick={handleSaveEdit}
                        className='text-green-600 hover:text-green-800 px-2 py-1 text-sm'
                        title='Save'
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className='text-gray-600 hover:text-gray-800 px-2 py-1 text-sm'
                        title='Cancel'
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`cursor-pointer ${
                        item.isCompleted
                          ? 'line-through text-gray-500'
                          : 'text-gray-900'
                      }`}
                      onClick={() => handleStartEdit(item)}
                    >
                      {item.content}
                    </div>
                  )}
                </div>
                {editingItemId !== item.id && (
                  <button
                    onClick={() => handleDeleteClick(item)}
                    className='text-red-500 hover:text-red-700 p-1'
                    title='Delete item'
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          />
        )}
      </div>

      {/* Debug Panel */}
      {import.meta.env.MODE === 'development' && (
        <div className='mt-8 p-4 bg-gray-100 rounded-lg'>
          <h3 className='font-semibold mb-2'>Debug Info</h3>
          <div className='text-sm space-y-1'>
            <div>List UUID: {listId}</div>
            <div>List Name: {title}</div>
            <div>Document Found: {document ? 'Yes' : 'No'}</div>
            <div>Items Count: {items.length}</div>
            <div>Is Loading: {isLoading ? 'Yes' : 'No'}</div>
            <div>Was Deleted Remotely: {wasDeletedRemotely ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title='Delete Item'
        message={`Are you sure you want to delete "${itemToDelete?.content}"? This action cannot be undone.`}
        isDeleting={isDeletingItem}
      />

      {/* Delete List Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteListModal}
        onClose={handleDeleteListCancel}
        onConfirm={handleDeleteListConfirm}
        title='Delete List'
        message={`Are you sure you want to delete "${title}"? This will permanently remove the list and all its items. This action cannot be undone.`}
        isDeleting={isDeletingList}
      />

      {/* Clear Completed Items Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showClearCompletedModal}
        onClose={handleClearCompletedCancel}
        onConfirm={handleClearCompletedConfirm}
        title='Clear Completed Items'
        message={`Are you sure you want to clear all completed items from "${title}"? This action cannot be undone.`}
        isDeleting={isClearingCompleted}
      />

      {/* Leave List Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showLeaveListModal}
        onClose={handleLeaveListCancel}
        onConfirm={handleLeaveListConfirm}
        title='Leave List'
        message={`Are you sure you want to leave "${title}"? You will no longer have access to this list and all local data will be removed.`}
        isDeleting={isLeavingList}
      />

      {/* List Edit Modal */}
      <ListEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveListEdit}
        currentTitle={title}
        currentDescription={listDocument?.description || ''}
        isSaving={isEditingList}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        listId={listId || ''}
        listTitle={title}
      />
    </div>
  );
};

export default ListPage;
