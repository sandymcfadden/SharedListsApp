import { CollaborativeListItem } from '@/types/List';

/**
 * Represents an optimistic item that may not yet be confirmed by the server
 */
export interface OptimisticItem extends CollaborativeListItem {
  /** Flag to identify optimistic items */
  isOptimistic?: boolean;
  /** Temporary ID for optimistic updates */
  tempId?: string;
}
