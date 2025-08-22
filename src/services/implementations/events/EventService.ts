import {
  Event,
  EventTypeString,
  EventHandler,
  EVENT_TYPES,
} from '@/types/EventTypes';
import { IEventService } from '@/services/interfaces/IEventService';
import { ILogService } from '@/services/interfaces/ILogService';

/**
 * Unified event service that combines events with basic event handling
 * No cross-tab communication - everything happens in-memory within a single tab
 */
export class EventService implements IEventService {
  // Event subscriptions
  private eventSubscriptions = new Map<string, Set<EventHandler<Event>>>();

  constructor(private logger: ILogService) {}

  // ===== EVENT METHODS =====

  publish(event: Event): void {
    // Ensure event has timestamp
    const timestamp = new Date();
    const eventWithTimestamp = { ...event, timestamp };

    // Notify event subscribers
    this.notifyEventSubscribers(eventWithTimestamp);
  }

  // ===== EVENT SUBSCRIPTION METHODS =====

  subscribe<T extends Event>(
    eventType: EventTypeString,
    handler: EventHandler<T>
  ): () => void {
    const wrappedHandler = this.wrapHandler(handler);

    if (!this.eventSubscriptions.has(eventType)) {
      this.eventSubscriptions.set(eventType, new Set());
    }

    this.eventSubscriptions
      .get(eventType)!
      .add(wrappedHandler as EventHandler<Event>);

    return () => {
      const handlers = this.eventSubscriptions.get(eventType);
      if (handlers) {
        handlers.delete(wrappedHandler as EventHandler<Event>);
        if (handlers.size === 0) {
          this.eventSubscriptions.delete(eventType);
        }
      }
    };
  }

  private subscribeToMultiple<T extends Event>(
    eventTypes: EventTypeString[],
    handler: EventHandler<T>
  ): () => void {
    const unsubscribers = eventTypes.map(eventType =>
      this.subscribe(eventType, handler)
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }

  subscribeToListEvents(handler: EventHandler<Event>): () => void {
    const listEventTypes: EventTypeString[] = [
      EVENT_TYPES.LIST_CREATED,
      EVENT_TYPES.LIST_DELETED,
      EVENT_TYPES.LIST_METADATA_CHANGED,
      EVENT_TYPES.ITEM_ADDED,
      EVENT_TYPES.ITEM_DELETED,
      EVENT_TYPES.ITEM_CONTENT_CHANGED,
      EVENT_TYPES.ITEM_COMPLETED,
      EVENT_TYPES.ITEM_UNCOMPLETED,
      EVENT_TYPES.ITEM_MOVED,
    ];

    return this.subscribeToMultiple(listEventTypes, handler);
  }

  // ===== UTILITY METHODS =====

  clearAllSubscriptions(): void {
    this.eventSubscriptions.clear();
  }

  // ===== PRIVATE METHODS =====

  private notifyEventSubscribers(event: Event): void {
    const handlers = this.eventSubscriptions.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          this.logger.errorSync('Error in event handler:', error);
        }
      });
    }
  }

  private wrapHandler<T extends Event>(
    handler: EventHandler<T>
  ): EventHandler<T> {
    return (event: T) => {
      // Call handler
      handler(event);
    };
  }
}
