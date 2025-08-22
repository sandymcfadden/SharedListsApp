import { useState, useEffect, useCallback } from 'react';
import { ServiceContainer } from '@/services/container';
import { CollaborativeDocument } from '@/types/List';
import { EVENT_TYPES } from '@/types/EventTypes';

/**
 * Hook for subscribing to individual list changes
 * This prevents unnecessary re-renders of other list components
 */
export function useListSubscription(listId: string) {
  const [list, setList] = useState<CollaborativeDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceContainer = ServiceContainer.getInstance();
  const listController = serviceContainer.getListController();
  const logger = serviceContainer.getLogService();
  const eventService = serviceContainer.getEventService();

  // Load the specific list
  const loadList = useCallback(async () => {
    if (!listId) return;

    try {
      setIsLoading(true);
      setError(null);

      logger.debugSync(`useListSubscription: Loading list ${listId}`);
      const listData = await listController.getList(listId);
      setList(listData);

      if (listData) {
        logger.debugSync(
          `useListSubscription: Loaded list ${listId} with ${listData.items.length} items`
        );
      } else {
        logger.debugSync(`useListSubscription: List ${listId} not found`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.errorSync(
        `useListSubscription: Failed to load list ${listId}:`,
        err
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [listId, listController, logger]);

  // Load list on mount
  useEffect(() => {
    loadList();
  }, [loadList]);

  // Subscribe to list-specific events
  useEffect(() => {
    if (!listId) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to list metadata changes (title, statistics, etc.)
    const unsubscribeMetadataChanged = eventService.subscribe(
      EVENT_TYPES.LIST_METADATA_CHANGED,
      async event => {
        const payload = event.payload as { listId: string };
        if (payload.listId === listId) {
          logger.debugSync(
            `useListSubscription: Received metadata change for list ${listId}, refreshing`
          );
          loadList();
        }
      }
    );

    // Subscribe to bootstrap completion events
    const unsubscribeBootstrapCompleted = eventService.subscribe(
      EVENT_TYPES.BOOTSTRAP_COMPLETED,
      async () => {
        logger.debugSync(
          `useListSubscription: Received bootstrap completion, refreshing list ${listId}`
        );
        loadList();
      }
    );

    // Subscribe to list deletion events
    const unsubscribeListDeleted = eventService.subscribe(
      EVENT_TYPES.LIST_DELETED,
      async event => {
        const payload = event.payload as { listId: string };
        if (payload.listId === listId) {
          logger.debugSync(
            `useListSubscription: List ${listId} was deleted, clearing state`
          );
          setList(null);
          setIsLoading(false);
        }
      }
    );

    unsubscribers.push(
      unsubscribeMetadataChanged,
      unsubscribeBootstrapCompleted,
      unsubscribeListDeleted
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [listId, eventService, loadList, logger]);

  return {
    list,
    isLoading,
    error,
    refreshList: loadList,
  };
}
