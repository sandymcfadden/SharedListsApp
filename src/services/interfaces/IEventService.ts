import { Event, EventTypeString, EventHandler } from '@/types/EventTypes';

/**
 * Unified event service interface that combines basic and event capabilities
 * No cross-tab communication - everything happens in-memory within a single tab
 */
export interface IEventService {
  // ===== EVENT METHODS =====

  // Event publishing
  publish(event: Event): void;

  // ===== EVENT SUBSCRIPTION METHODS =====

  // Event subscriptions
  subscribe<T extends Event>(
    eventType: EventTypeString,
    handler: EventHandler<T>
  ): () => void;

  // Subscribe to all events for a specific list
  subscribeToListEvents(handler: EventHandler<Event>): () => void;

  // Cleanup

  clearAllSubscriptions(): void;
}
