import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressIndicator } from '@/components/ui/ProgressIndicator';
import { useListSubscription } from '@/hooks/useListSubscription';

interface ListItemProps {
  listId: string;
  onDeleteClick: (list: { name: string; uuid: string }) => void;
  isOwner?: boolean; // Whether the current user owns this list
}

/**
 * Individual list item component that only re-renders when its specific list changes
 * This prevents unnecessary re-renders of the entire homepage when other lists change
 */
const ListItem: React.FC<ListItemProps> = memo(
  ({ listId, onDeleteClick, isOwner = false }) => {
    const { list, isLoading, error } = useListSubscription(listId);
    const navigate = useNavigate();

    const handleClick = () => {
      if (list) {
        navigate(`/list/${list.id}`);
      }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (list) {
        onDeleteClick({ name: list.title, uuid: list.id });
      }
    };

    // Show loading state
    if (isLoading) {
      return (
        <div className='bg-white rounded-lg border border-gray-200 p-6 animate-pulse flex flex-col h-full'>
          <div className='flex items-start justify-between mb-3 flex-1'>
            <div className='flex-1'>
              <div className='h-5 bg-gray-200 rounded mb-2'></div>
              <div className='h-4 bg-gray-200 rounded w-20'></div>
            </div>
            <div className='h-6 w-6 bg-gray-200 rounded'></div>
          </div>
          <div className='h-2 bg-gray-200 rounded mt-auto'></div>
        </div>
      );
    }

    // Show error state
    if (error) {
      return (
        <div className='bg-red-50 rounded-lg border border-red-200 p-6 flex flex-col h-full'>
          <div className='flex items-start justify-between mb-3 flex-1'>
            <div className='flex-1'>
              <h3 className='text-lg font-medium text-red-900 mb-1'>
                Error loading list
              </h3>
              <p className='text-sm text-red-600'>{error}</p>
            </div>
          </div>
        </div>
      );
    }

    // Show deleted state (list was deleted)
    if (!list) {
      return null;
    }

    return (
      <div
        className='bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer flex flex-col h-full'
        onClick={handleClick}
      >
        <div className='flex items-start justify-between mb-3 flex-1'>
          <div className='flex-1'>
            <h3 className='text-lg font-medium text-gray-900 mb-1'>
              {list.title}
            </h3>
            {list.description && (
              <p className='text-sm text-gray-600 mb-2 line-clamp-2'>
                {list.description}
              </p>
            )}
            <p className='text-sm text-gray-500'>
              {list.createdAt &&
                `Created: ${list.createdAt.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}`}
              {list.updatedAt &&
                list.updatedAt.getTime() !== list.createdAt?.getTime() && (
                  <span className='block'>
                    Updated:{' '}
                    {list.updatedAt.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                )}
            </p>
          </div>
          {/* Only show delete button to list owners */}
          {isOwner && (
            <button
              onClick={handleDeleteClick}
              className='text-red-500 hover:text-red-700 p-1'
              title='Delete list'
            >
              🗑️
            </button>
          )}
        </div>

        {/* Progress indicator - aligned to bottom */}
        <ProgressIndicator
          completedItems={list.statistics.completedItems}
          totalItems={list.statistics.totalItems}
          className='mt-auto'
        />
      </div>
    );
  }
);

ListItem.displayName = 'ListItem';

export default ListItem;
