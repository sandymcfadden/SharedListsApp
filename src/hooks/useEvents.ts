import { useEffect, useCallback, useRef } from 'react';
import { Event, EventTypeString, EventHandler } from '@/types/EventTypes';
import { ServiceContainer } from '@/services/container';

/**
 * Hook for unified event subscriptions
 * Provides easy access to both basic and event functionality in React components
 */
export function useEvents() {
  const serviceContainer = ServiceContainer.getInstance();
  const eventService = serviceContainer.getEventService();
  const subscriptionsRef = useRef<Array<() => void>>([]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current = [];
    };
  }, []);

  const subscribe = useCallback(
    <T extends Event>(eventType: EventTypeString, handler: EventHandler<T>) => {
      const unsubscribe = eventService.subscribe(eventType, handler);
      subscriptionsRef.current.push(unsubscribe);
      return unsubscribe;
    },
    [eventService]
  );

  const subscribeToListEvents = useCallback(
    (handler: EventHandler<Event>) => {
      const unsubscribe = eventService.subscribeToListEvents(handler);
      subscriptionsRef.current.push(unsubscribe);
      return unsubscribe;
    },
    [eventService]
  );

  const publish = useCallback(
    <T extends Event>(event: T) => {
      eventService.publish(event);
    },
    [eventService]
  );

  return {
    subscribe,
    subscribeToListEvents,
    publish,
  };
}

/**
 * Hook for subscribing to specific list events
 */
export function useListEvents(handler: EventHandler<Event>) {
  const { subscribeToListEvents } = useEvents();

  useEffect(() => {
    const unsubscribe = subscribeToListEvents(handler);
    return unsubscribe;
  }, [handler, subscribeToListEvents]);
}
