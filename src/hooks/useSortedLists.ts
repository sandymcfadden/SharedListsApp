import { useState, useEffect, useCallback, useMemo } from 'react';
import { ServiceContainer } from '@/services/container';
import { useEvents } from '@/hooks/useEvents';
import { EVENT_TYPES, Event, EventTypeString } from '@/types/EventTypes';
import { CollaborativeDocument } from '@/types/List';

/**
 * Hook for managing sorted lists by last updated date
 * Returns lists sorted by updatedAt (most recent first)
 */
export function useSortedLists() {
  const [lists, setLists] = useState<CollaborativeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceContainer = ServiceContainer.getInstance();
  const listController = serviceContainer.getListController();
  const logger = serviceContainer.getLogService();
  const eventService = serviceContainer.getEventService();
  const { subscribe } = useEvents();

  // Load all lists with their data
  const loadLists = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      logger.debugSync('useSortedLists: Loading all lists');
      const allLists = await listController.getAllLists();
      setLists(allLists);

      logger.debugSync(`useSortedLists: Loaded ${allLists.length} lists`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.errorSync('useSortedLists: Failed to load lists:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [listController, logger]);

  // Sort lists by updatedAt (most recent first)
  const sortedLists = useMemo(() => {
    return [...lists].sort((a, b) => {
      // Handle cases where updatedAt might be undefined
      const aTime = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
      const bTime = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;

      // Sort in descending order (most recent first)
      return bTime - aTime;
    });
  }, [lists]);

  // Load lists on mount
  useEffect(() => {
    loadLists();
  }, [loadLists]);

  // Subscribe to list events
  useEffect(() => {
    // Ensure EventService is ready before setting up subscriptions
    if (!eventService) {
      logger.warnSync(
        'useSortedLists: EventService not ready, skipping subscription setup'
      );
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // Helper function to create subscriptions with error handling
    const createSubscription = (
      eventType: EventTypeString,
      handler: (event: Event) => void
    ) => {
      try {
        return eventService.subscribe(eventType, handler);
      } catch (error) {
        logger.errorSync(`Failed to subscribe to ${eventType}:`, error);
        // Return a no-op unsubscribe function to prevent errors
        return () => {};
      }
    };

    // Subscribe to list creation events
    const unsubscribeCreated = createSubscription(
      EVENT_TYPES.LIST_CREATED,
      async (event: Event) => {
        try {
          const payload = event.payload as { listId: string };
          logger.debugSync(
            `useSortedLists: Received list_created event for list ${payload.listId}`
          );

          // Reload all lists to get the new list with proper data
          await loadLists();
        } catch (error) {
          logger.errorSync('Error handling list_created event:', error);
        }
      }
    );

    // Subscribe to list deletion events
    const unsubscribeDeleted = createSubscription(
      EVENT_TYPES.LIST_DELETED,
      async (event: Event) => {
        try {
          const payload = event.payload as { listId: string };
          logger.debugSync(
            `useSortedLists: Received list_deleted event for list ${payload.listId}`
          );

          setLists(prev => prev.filter(list => list.id !== payload.listId));
        } catch (error) {
          logger.errorSync('Error handling list_deleted event:', error);
        }
      }
    );

    // Subscribe to bootstrap completion events
    const unsubscribeBootstrapCompleted = createSubscription(
      EVENT_TYPES.BOOTSTRAP_COMPLETED,
      async () => {
        try {
          logger.debugSync(
            'useSortedLists: Received bootstrap completion, refreshing lists'
          );
          await loadLists();
        } catch (error) {
          logger.errorSync('Error handling bootstrap_completed event:', error);
        }
      }
    );

    // Subscribe to event list creation events (for remote list creation)
    const unsubscribeToEventCreated = subscribe(
      EVENT_TYPES.LIST_CREATED,
      async (event: Event) => {
        try {
          const payload = event.payload as { listId: string };
          logger.debugSync(
            `useSortedLists: Received event list_created event for list ${payload.listId}`
          );

          // Reload all lists to get the new list with proper data
          await loadLists();
        } catch (error) {
          logger.errorSync('Error handling remote list_created event:', error);
        }
      }
    );

    // Subscribe to event list deletion events (for remote list deletion)
    const unsubscribeToEventDeleted = subscribe(
      EVENT_TYPES.LIST_DELETED,
      async (event: Event) => {
        try {
          const payload = event.payload as { listId: string };
          logger.debugSync(
            `useSortedLists: Received event list_deleted event for list ${payload.listId}`
          );

          setLists(prev => prev.filter(list => list.id !== payload.listId));
        } catch (error) {
          logger.errorSync('Error handling remote list_deleted event:', error);
        }
      }
    );

    // Subscribe to list metadata changes (for when lists are updated)
    const unsubscribeMetadataChanged = createSubscription(
      EVENT_TYPES.LIST_METADATA_CHANGED,
      async (event: Event) => {
        try {
          const payload = event.payload as { listId: string };
          logger.debugSync(
            `useSortedLists: Received list_metadata_changed event for list ${payload.listId}`
          );

          // Reload the specific list to get updated metadata
          const updatedList = await listController.getList(payload.listId);
          if (updatedList) {
            setLists(prev => {
              const filtered = prev.filter(list => list.id !== payload.listId);
              return [...filtered, updatedList];
            });
          }
        } catch (err) {
          logger.errorSync(
            'useSortedLists: Failed to reload updated list:',
            err
          );
        }
      }
    );

    unsubscribers.push(
      unsubscribeCreated,
      unsubscribeDeleted,
      unsubscribeBootstrapCompleted,
      unsubscribeToEventCreated,
      unsubscribeToEventDeleted,
      unsubscribeMetadataChanged
    );

    logger.debugSync(
      'useSortedLists: Successfully set up all event subscriptions'
    );

    return () => {
      logger.debugSync('useSortedLists: Cleaning up event subscriptions');
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [eventService, logger, subscribe, listController]);

  return {
    lists: sortedLists,
    isLoading,
    error,
    refreshLists: loadLists,
  };
}
