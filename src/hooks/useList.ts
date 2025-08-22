import { useState, useEffect, useCallback, useMemo } from 'react';
import { ServiceContainer } from '@/services/container';
import { CollaborativeDocument } from '@/types/List';
import { OptimisticItem } from '@/types/OptimisticUpdate';
import { generateTempId } from '@/utils/uuid';
import { debounce } from '@/utils/debounce';
import { useListEvents } from './useEvents';
import { EVENT_TYPES, Event } from '@/types/EventTypes';

export function useList(listId: string) {
  const [document, setDocument] = useState<CollaborativeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasDeletedRemotely, setWasDeletedRemotely] = useState(false);

  // Loading states for individual operations
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [isTogglingItem, setIsTogglingItem] = useState(false);
  const [isMovingItem, setIsMovingItem] = useState(false);

  const serviceContainer = ServiceContainer.getInstance();
  const listController = serviceContainer.getListController();
  const logger = serviceContainer.getLogService();
  const eventService = serviceContainer.getEventService();

  // Load the list
  const loadList = useCallback(async () => {
    if (!listId) return;

    try {
      setIsLoading(true);
      setError(null);

      logger.infoSync(`useNewList: Loading list ${listId}`);
      const list = await listController.getList(listId);
      setDocument(list);

      if (!list) {
        setError('List not found');
      } else {
        logger.infoSync(`useNewList: Loaded list ${listId}: ${list.title}`);
      }
    } catch (error) {
      logger.errorSync(`useNewList: Error loading list ${listId}:`, error);
      setError(error instanceof Error ? error.message : 'Failed to load list');
    } finally {
      setIsLoading(false);
    }
  }, [listId, listController, logger]);

  // Create debounced version of loadList for event subscriptions
  const debouncedLoadList = useMemo(() => debounce(loadList, 300), [loadList]);

  // Add an item to the list with optimistic updates
  const addItem = useCallback(
    async (text: string): Promise<void> => {
      if (!listId || !document) return;

      const tempId = generateTempId();
      const optimisticItem: OptimisticItem = {
        id: tempId,
        content: text,
        isCompleted: false,
        isOptimistic: true,
        tempId,
      };

      // Store previous state for rollback
      const previousDocument = document;

      try {
        setIsAddingItem(true);
        setError(null);

        // Optimistically update UI immediately
        setDocument(prev => ({
          ...prev!,
          items: [...prev!.items, optimisticItem],
        }));

        logger.infoSync(`useNewList: Adding item to list ${listId}: ${text}`);
        await listController.addItem(listId, text);
        logger.infoSync(`useNewList: Added item to list ${listId}`);

        // Server response will trigger real update via events
        // No need to manually refresh
      } catch (error) {
        logger.errorSync(
          `useNewList: Error adding item to list ${listId}:`,
          error
        );

        // Rollback optimistic update on error
        setDocument(previousDocument);
        setError(
          `Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);

        throw error;
      } finally {
        setIsAddingItem(false);
      }
    },
    [listId, document, listController, logger]
  );

  // Edit an item in the list with optimistic updates
  const updateItem = useCallback(
    async (itemId: string, updates: { content: string }): Promise<void> => {
      if (!listId || !document) return;

      // Find the item to update
      const itemToUpdate = document.items.find(item => item.id === itemId);
      if (!itemToUpdate) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      // Store previous state for rollback
      const previousDocument = document;

      try {
        setIsUpdatingItem(true);
        setError(null);

        // Optimistically update UI immediately
        setDocument(prev => ({
          ...prev!,
          items: prev!.items.map(item =>
            item.id === itemId ? { ...item, content: updates.content } : item
          ),
        }));

        logger.infoSync(
          `useNewList: Updating item ${itemId} in list ${listId}: ${updates.content}`
        );
        await listController.editItem(listId, itemId, updates.content);
        logger.infoSync(`useNewList: Updated item ${itemId} in list ${listId}`);

        // Server response will trigger real update via events
      } catch (error) {
        logger.errorSync(
          `useNewList: Error updating item ${itemId} in list ${listId}:`,
          error
        );

        // Rollback optimistic update on error
        setDocument(previousDocument);
        setError(
          `Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);

        throw error;
      } finally {
        setIsUpdatingItem(false);
      }
    },
    [listId, document, listController, logger]
  );

  // Delete an item from the list with optimistic updates
  const deleteItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (!listId || !document) return;

      // Find the item to delete
      const itemToDelete = document.items.find(item => item.id === itemId);
      if (!itemToDelete) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      // Store previous state for rollback
      const previousDocument = document;

      try {
        setIsDeletingItem(true);
        setError(null);

        // Optimistically update UI immediately
        setDocument(prev => ({
          ...prev!,
          items: prev!.items.filter(item => item.id !== itemId),
        }));

        logger.infoSync(
          `useNewList: Deleting item ${itemId} from list ${listId}`
        );
        await listController.deleteItem(listId, itemId);
        logger.infoSync(
          `useNewList: Deleted item ${itemId} from list ${listId}`
        );

        // Server response will trigger real update via events
      } catch (error) {
        logger.errorSync(
          `useNewList: Error deleting item ${itemId} from list ${listId}:`,
          error
        );

        // Rollback optimistic update on error
        setDocument(previousDocument);
        setError(
          `Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);

        throw error;
      } finally {
        setIsDeletingItem(false);
      }
    },
    [listId, document, listController, logger]
  );

  // Toggle an item's completion status with optimistic updates
  const toggleItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (!listId || !document) return;

      // Find the item to toggle
      const itemToToggle = document.items.find(item => item.id === itemId);
      if (!itemToToggle) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      // Store previous state for rollback
      const previousDocument = document;

      try {
        setIsTogglingItem(true);
        setError(null);

        // Optimistically update UI immediately
        setDocument(prev => ({
          ...prev!,
          items: prev!.items.map(item =>
            item.id === itemId
              ? { ...item, isCompleted: !item.isCompleted }
              : item
          ),
        }));

        logger.infoSync(
          `useNewList: Toggling item ${itemId} in list ${listId}`
        );
        await listController.toggleItem(listId, itemId);
        logger.infoSync(`useNewList: Toggled item ${itemId} in list ${listId}`);

        // Server response will trigger real update via events
      } catch (error) {
        logger.errorSync(
          `useNewList: Error toggling item ${itemId} in list ${listId}:`,
          error
        );

        // Rollback optimistic update on error
        setDocument(previousDocument);
        setError(
          `Failed to toggle item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);

        throw error;
      } finally {
        setIsTogglingItem(false);
      }
    },
    [listId, document, listController, logger]
  );

  // Move an item to a new position with optimistic updates
  const moveItem = useCallback(
    async (itemId: string, newIndex: number): Promise<void> => {
      if (!listId || !document) return;

      // Find the item to move
      const itemToMove = document.items.find(item => item.id === itemId);
      if (!itemToMove) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      // Store previous state for rollback
      const previousDocument = document;

      try {
        setIsMovingItem(true);
        setError(null);

        // Optimistically update UI immediately
        setDocument(prev => {
          const items = [...prev!.items];
          const currentIndex = items.findIndex(item => item.id === itemId);

          if (currentIndex !== -1) {
            // Remove item from current position
            const [movedItem] = items.splice(currentIndex, 1);
            // Insert at new position
            items.splice(newIndex, 0, movedItem);
          }

          return { ...prev!, items };
        });

        logger.infoSync(
          `useNewList: Moving item ${itemId} to position ${newIndex} in list ${listId}`
        );
        await listController.moveItem(listId, itemId, newIndex);
        logger.infoSync(
          `useNewList: Moved item ${itemId} to position ${newIndex} in list ${listId}`
        );

        // Server response will trigger real update via events
      } catch (error) {
        logger.errorSync(
          `useNewList: Error moving item ${itemId} in list ${listId}:`,
          error
        );

        // Rollback optimistic update on error
        setDocument(previousDocument);
        setError(
          `Failed to move item: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);

        throw error;
      } finally {
        setIsMovingItem(false);
      }
    },
    [listId, document, listController, logger]
  );

  // Edit list metadata (title and/or description)
  const editListMetadata = useCallback(
    async (updates: {
      title?: string;
      description?: string;
    }): Promise<void> => {
      if (!listId || !document) return;

      // Store previous state for rollback
      const previousDocument = document;

      try {
        setError(null);

        // Optimistically update UI immediately
        setDocument(prev => ({
          ...prev!,
          ...updates,
        }));

        logger.infoSync(
          `useNewList: Editing metadata of list ${listId}: ${JSON.stringify(updates)}`
        );
        await listController.editListMetadata(listId, updates);
        logger.infoSync(
          `useNewList: Edited metadata of list ${listId}: ${JSON.stringify(updates)}`
        );

        // Server response will trigger real update via events
      } catch (error) {
        logger.errorSync(
          `useNewList: Error editing metadata of list ${listId}:`,
          error
        );

        // Rollback optimistic update on error
        setDocument(previousDocument);
        setError(
          `Failed to edit metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);

        throw error;
      }
    },
    [listId, document, listController, logger]
  );

  // Delete list
  const deleteList = useCallback(async (): Promise<void> => {
    if (!listId) return;

    try {
      setError(null);
      logger.infoSync(`useNewList: Deleting list ${listId}`);

      await listController.deleteList(listId);
      logger.infoSync(`useNewList: Deleted list ${listId}`);

      // The list deletion will trigger a LIST_DELETED event
      // which will set wasDeletedRemotely to true and redirect the user
    } catch (error) {
      logger.errorSync(`useNewList: Error deleting list ${listId}:`, error);
      setError(
        `Failed to delete list: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
      throw error;
    }
  }, [listId, listController, logger]);

  // Clear completed items
  const clearCompletedItems = useCallback(async (): Promise<void> => {
    if (!listId || !document) return;

    // Store previous state for rollback
    const previousDocument = document;

    try {
      setError(null);

      // Optimistically update UI immediately
      setDocument(prev => ({
        ...prev!,
        items: prev!.items.filter(item => !item.isCompleted),
      }));

      logger.infoSync(
        `useNewList: Clearing completed items from list ${listId}`
      );
      await listController.clearCompletedItems(listId);
      logger.infoSync(
        `useNewList: Cleared completed items from list ${listId}`
      );

      // Server response will trigger real update via events
    } catch (error) {
      logger.errorSync(
        `useNewList: Error clearing completed items from list ${listId}:`,
        error
      );

      // Rollback optimistic update on error
      setDocument(previousDocument);
      setError(
        `Failed to clear completed items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);

      throw error;
    }
  }, [listId, document, listController, logger]);

  // Leave list
  const leaveList = useCallback(async (): Promise<void> => {
    if (!listId) return;

    try {
      setError(null);
      logger.infoSync(`useNewList: Leaving list ${listId}`);

      await listController.leaveList(listId);
      logger.infoSync(`useNewList: Left list ${listId}`);

      // The list leaving will trigger a LIST_LEFT event
      // which will set wasDeletedRemotely to true and redirect the user
    } catch (error) {
      logger.errorSync(`useNewList: Error leaving list ${listId}:`, error);
      setError(
        `Failed to leave list: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
      throw error;
    }
  }, [listId, listController, logger]);

  // Load list on mount
  useEffect(() => {
    loadList();
  }, [loadList]);

  // Memoize the event handler to prevent unnecessary re-subscriptions
  const handleListEvent = useCallback(
    async (event: Event) => {
      try {
        switch (event.type) {
          case EVENT_TYPES.LIST_DELETED:
            logger.infoSync(`useNewList: List ${listId} was deleted remotely`);
            setWasDeletedRemotely(true);
            setDocument(null);
            break;

          case EVENT_TYPES.LIST_LEFT:
            logger.infoSync(`useNewList: List ${listId} was left by user`);
            setWasDeletedRemotely(true);
            setDocument(null);
            break;

          case EVENT_TYPES.ITEM_ADDED: {
            // Special handling for ITEM_ADDED events during optimistic operations
            if (isAddingItem) {
              // Replace optimistic item with real item
              const payload = event.payload as {
                itemId: string;
                content: string;
              };
              logger.infoSync(
                `useNewList: Received ITEM_ADDED event for item ${payload.itemId} while adding, replacing optimistic item`
              );

              setDocument(prev => {
                if (!prev) return prev;

                // Find and replace the optimistic item with the real item
                const updatedItems = prev.items.map(item => {
                  if (
                    (item as OptimisticItem).isOptimistic &&
                    item.content === payload.content
                  ) {
                    return {
                      ...item,
                      id: payload.itemId,
                      isOptimistic: false,
                      tempId: undefined,
                    };
                  }
                  return item;
                });

                return {
                  ...prev,
                  items: updatedItems,
                };
              });
            } else {
              // Normal handling - reload the list
              logger.infoSync(
                `useNewList: List ${listId} was changed (${event.type}), refreshing (debounced)`
              );
              debouncedLoadList();
            }
            break;
          }

          case EVENT_TYPES.ITEM_DELETED:
          case EVENT_TYPES.ITEM_CONTENT_CHANGED:
          case EVENT_TYPES.ITEM_COMPLETED:
          case EVENT_TYPES.ITEM_UNCOMPLETED:
          case EVENT_TYPES.ITEM_MOVED: {
            // Only reload if we're not currently performing any optimistic operations
            const isPerformingOperation =
              isAddingItem ||
              isDeletingItem ||
              isUpdatingItem ||
              isTogglingItem ||
              isMovingItem;

            if (!isPerformingOperation) {
              logger.infoSync(
                `useNewList: List ${listId} was changed (${event.type}), refreshing (debounced)`
              );
              // Use debounced version to prevent excessive reloads
              debouncedLoadList();
            } else {
              logger.debugSync(
                `useNewList: Ignoring ${event.type} event as we're performing an optimistic operation`
              );
            }
            break;
          }

          case EVENT_TYPES.LIST_METADATA_CHANGED:
            logger.infoSync(
              `useNewList: List ${listId} metadata changed (${event.type}), refreshing (debounced)`
            );
            debouncedLoadList();
            break;

          default:
            // Ignore other event types
            break;
        }
      } catch (error) {
        logger.errorSync(
          `useNewList: Error handling event ${event.type}:`,
          error
        );
      }
    },
    [
      listId,
      logger,
      isAddingItem,
      isDeletingItem,
      isUpdatingItem,
      isTogglingItem,
      isMovingItem,
      debouncedLoadList,
    ]
  );

  // Subscribe to event list events for real-time updates
  useListEvents(handleListEvent);

  // Subscribe to bootstrap completion events
  useEffect(() => {
    const unsubscribeBootstrapCompleted = eventService.subscribe(
      EVENT_TYPES.BOOTSTRAP_COMPLETED,
      async () => {
        try {
          logger.infoSync(
            `useNewList: Received bootstrap_completed event for list ${listId}, refreshing`
          );
          // Use debounced version to prevent excessive reloads
          debouncedLoadList();
        } catch (error) {
          logger.errorSync(
            `useNewList: Error handling bootstrap_completed event:`,
            error
          );
        }
      }
    );

    return () => {
      unsubscribeBootstrapCompleted();
    };
  }, [eventService, debouncedLoadList, listId, logger]);

  // Reset deletion flag when document changes
  useEffect(() => {
    if (document) {
      setWasDeletedRemotely(false);
    }
  }, [document]);

  return {
    document,
    isLoading,
    error,
    wasDeletedRemotely,
    // Individual operation loading states
    isAddingItem,
    isUpdatingItem,
    isDeletingItem,
    isTogglingItem,
    isMovingItem,
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
    refreshList: loadList,
  };
}
