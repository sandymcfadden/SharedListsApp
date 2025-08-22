/**
 * Event types for unified event subscriptions
 * This allows components to subscribe only to the events they need
 */

// Base event interface
export interface Event {
  type: string;
  payload: unknown;
  timestamp: Date;
  source?: string;
  listId?: string;
  itemId?: string;
}

// Event type constants
export const EVENT_TYPES = {
  // List events
  LIST_CREATED: 'list_created',
  LIST_DELETED: 'list_deleted',
  LIST_LEFT: 'list_left',
  LIST_METADATA_CHANGED: 'list_metadata_changed',

  // Item events
  ITEM_ADDED: 'item_added',
  ITEM_DELETED: 'item_deleted',
  ITEM_CONTENT_CHANGED: 'item_content_changed',
  ITEM_COMPLETED: 'item_completed',
  ITEM_UNCOMPLETED: 'item_uncompleted',
  ITEM_MOVED: 'item_moved',

  // User events
  USER_JOINED_LIST: 'user_joined_list',
  USER_LEFT_LIST: 'user_left_list',

  // Connection events
  CONNECTION_ESTABLISHED: 'connection_established',
  CONNECTION_LOST: 'connection_lost',
  SYNC_COMPLETED: 'sync_completed',

  // System events
  BOOTSTRAP_COMPLETED: 'bootstrap_completed',
} as const;

// Type for event type strings
export type EventTypeString = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Event handler type
export type EventHandler<T extends Event = Event> = (event: T) => void;
