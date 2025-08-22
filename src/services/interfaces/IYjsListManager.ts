import { CollaborativeDocument } from '@/types/List';

/**
 * Interface for managing YJS documents for lists
 * This service handles all YJS CRDT operations and document lifecycle
 */
export interface IYjsListManager {
  // Document lifecycle
  createList(
    uuid: string,
    title: string,
    description?: string,
    ownerId?: string
  ): void;
  deleteList(uuid: string): void;

  // List operations
  getAllLists(): Array<{ id: string; title: string }>;
  getList(uuid: string): CollaborativeDocument | null;

  // Item operations
  addItem(listId: string, text: string): string | null;
  editItem(listId: string, itemId: string, text: string): void;
  deleteItem(listId: string, itemId: string): void;
  toggleItem(listId: string, itemId: string): void;
  moveItem(listId: string, itemId: string, newIndex: number): void;
  clearCompletedItems(listId: string): void;

  // List operations
  editListTitle(listId: string, newTitle: string): void;
  editListDescription(listId: string, newDescription: string): void;

  // YJS state management
  getYjsState(uuid: string): Uint8Array | null;
  applyYjsUpdate(uuid: string, update: Uint8Array): void;

  // Utility methods
  isListLoaded(uuid: string): boolean;
  clearAllState(): void;
}
