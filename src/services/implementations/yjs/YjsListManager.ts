import { IYjsListManager } from '@/services/interfaces/IYjsListManager';
import { CollaborativeDocument, CollaborativeListItem } from '@/types/List';
import { ILogService } from '@/services/interfaces/ILogService';
import * as Y from 'yjs';
import { YjsListItemData, YjsListMetadata } from '@/types/List';
import { calculateListStatistics } from '@/utils/listUtils';
import { generateUUID } from '@/utils/uuid';

export class YjsListManager implements IYjsListManager {
  private documents: Map<string, Y.Doc> = new Map();
  private logger: ILogService;

  constructor(logger: ILogService) {
    this.logger = logger;
  }

  private updateTimestamp(uuid: string): void {
    const doc = this.documents.get(uuid);
    if (doc) {
      const meta = doc.getMap('meta') as YjsListMetadata;
      meta.set('updatedAt', new Date().toISOString());
    }
  }

  createList(
    uuid: string,
    title: string,
    description?: string,
    ownerId?: string
  ): void {
    if (this.documents.has(uuid)) {
      this.logger.warnSync(`List ${uuid} already exists`);
      return;
    }

    const doc = new Y.Doc();
    const meta = doc.getMap('meta') as YjsListMetadata;
    const now = new Date();

    // Initialize with the provided title, description, ownerId, and timestamps
    meta.set('title', title);
    if (description) {
      meta.set('description', description);
    }
    if (ownerId) {
      meta.set('ownerId', ownerId);
    }
    meta.set('createdAt', now.toISOString());
    meta.set('updatedAt', now.toISOString());

    this.documents.set(uuid, doc);
    this.logger.infoSync(
      `Created YJS document for list ${uuid} with title: ${title}${description ? ` and description: ${description}` : ''}${ownerId ? ` and ownerId: ${ownerId}` : ''}`
    );
  }

  deleteList(uuid: string): void {
    const doc = this.documents.get(uuid);
    if (!doc) {
      this.logger.warnSync(`List ${uuid} not found for deletion`);
      return;
    }

    doc.destroy();
    this.documents.delete(uuid);
    this.logger.infoSync(`Deleted YJS document for list ${uuid}`);
  }

  getAllLists(): Array<{ id: string; title: string }> {
    const lists: Array<{ id: string; title: string }> = [];

    for (const [uuid, doc] of this.documents) {
      const meta = doc.getMap('meta') as YjsListMetadata;
      const title = meta.get('title') || 'Untitled List';
      lists.push({ id: uuid, title });
    }

    return lists;
  }

  getList(uuid: string): CollaborativeDocument | null {
    const doc = this.documents.get(uuid);
    if (!doc) {
      return null;
    }

    const meta = doc.getMap('meta') as YjsListMetadata;
    const title = meta.get('title') || 'Untitled List';
    const description = meta.get('description');
    const ownerId = meta.get('ownerId');
    const createdAtStr = meta.get('createdAt');
    const updatedAtStr = meta.get('updatedAt');
    const items = doc.getArray('items') as Y.Array<YjsListItemData>;

    const collaborativeItems: CollaborativeListItem[] = [];
    items.forEach((itemData: YjsListItemData) => {
      collaborativeItems.push({
        id: itemData.id,
        content: itemData.content,
        isCompleted: itemData.isCompleted,
      });
    });

    const statistics = calculateListStatistics(collaborativeItems);

    return {
      id: uuid,
      title,
      description,
      items: collaborativeItems,
      statistics,
      isConnected: true, // TODO: Implement connection status
      isSynced: true, // TODO: Implement sync status
      createdAt: createdAtStr ? new Date(createdAtStr) : undefined,
      updatedAt: updatedAtStr ? new Date(updatedAtStr) : undefined,
      ownerId,
    };
  }

  addItem(listId: string, text: string): string | null {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for adding item`);
      return null;
    }

    const items = doc.getArray('items') as Y.Array<YjsListItemData>;

    const newItem: YjsListItemData = {
      id: generateUUID(),
      content: text,
      isCompleted: false,
    };

    items.push([newItem]);
    this.updateTimestamp(listId);
    this.logger.infoSync(`Added item to list ${listId}: ${text}`);
    return newItem.id;
  }

  editItem(listId: string, itemId: string, text: string): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for editing item`);
      return;
    }

    const items = doc.getArray('items') as Y.Array<YjsListItemData>;

    for (let i = 0; i < items.length; i++) {
      const item = items.get(i);
      if (item && item.id === itemId) {
        items.delete(i, 1);
        items.insert(i, [
          {
            ...item,
            content: text,
          },
        ]);
        this.updateTimestamp(listId);
        this.logger.infoSync(`Edited item ${itemId} in list ${listId}`);
        return;
      }
    }

    this.logger.warnSync(`Item ${itemId} not found in list ${listId}`);
  }

  deleteItem(listId: string, itemId: string): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for deleting item`);
      return;
    }

    const items = doc.getArray('items') as Y.Array<YjsListItemData>;

    for (let i = 0; i < items.length; i++) {
      const item = items.get(i);
      if (item && item.id === itemId) {
        items.delete(i, 1);
        this.updateTimestamp(listId);
        this.logger.infoSync(`Deleted item ${itemId} from list ${listId}`);
        return;
      }
    }

    this.logger.warnSync(`Item ${itemId} not found in list ${listId}`);
  }

  toggleItem(listId: string, itemId: string): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for toggling item`);
      return;
    }

    const items = doc.getArray('items') as Y.Array<YjsListItemData>;

    for (let i = 0; i < items.length; i++) {
      const item = items.get(i);
      if (item && item.id === itemId) {
        items.delete(i, 1);
        items.insert(i, [
          {
            ...item,
            isCompleted: !item.isCompleted,
          },
        ]);
        this.updateTimestamp(listId);
        this.logger.infoSync(`Toggled item ${itemId} in list ${listId}`);
        return;
      }
    }

    this.logger.warnSync(`Item ${itemId} not found in list ${listId}`);
  }

  moveItem(listId: string, itemId: string, newIndex: number): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for moving item`);
      return;
    }

    const items = doc.getArray('items') as Y.Array<YjsListItemData>;

    // Find the item to move
    let currentIndex = -1;
    let itemToMove: YjsListItemData | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items.get(i);
      if (item && item.id === itemId) {
        currentIndex = i;
        itemToMove = item;
        break;
      }
    }

    if (currentIndex === -1 || !itemToMove) {
      this.logger.warnSync(`Item ${itemId} not found in list ${listId}`);
      return;
    }

    // Clamp newIndex to valid range
    const clampedNewIndex = Math.max(0, Math.min(newIndex, items.length - 1));

    if (currentIndex === clampedNewIndex) {
      this.logger.debugSync(
        `Item ${itemId} is already at position ${clampedNewIndex}`
      );
      return;
    }

    // Remove item from current position
    items.delete(currentIndex, 1);

    // Insert item at new position
    // Adjust index if we removed an item before the target position
    const adjustedIndex =
      currentIndex < clampedNewIndex ? clampedNewIndex - 1 : clampedNewIndex;
    items.insert(adjustedIndex, [itemToMove]);

    this.updateTimestamp(listId);
    this.logger.infoSync(
      `Moved item ${itemId} from position ${currentIndex} to ${adjustedIndex} in list ${listId}`
    );
  }

  getYjsState(uuid: string): Uint8Array | null {
    const doc = this.documents.get(uuid);
    if (!doc) {
      return null;
    }
    return Y.encodeStateAsUpdate(doc);
  }

  applyYjsUpdate(uuid: string, update: Uint8Array): void {
    let doc = this.documents.get(uuid);
    if (!doc) {
      // Create a new document if it doesn't exist
      doc = new Y.Doc();
      this.documents.set(uuid, doc);
      this.logger.infoSync(
        `Created new YJS document for list ${uuid} during update application`
      );
    }

    Y.applyUpdate(doc, update);
    this.logger.infoSync(`Applied YJS update to list ${uuid}`);
  }

  isListLoaded(uuid: string): boolean {
    return this.documents.has(uuid);
  }

  /**
   * Edit list title
   */
  editListTitle(listId: string, newTitle: string): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for editing title`);
      return;
    }

    const meta = doc.getMap('meta') as YjsListMetadata;
    meta.set('title', newTitle);
    this.updateTimestamp(listId);
    this.logger.infoSync(`Edited title of list ${listId} to: ${newTitle}`);
  }

  /**
   * Edit list description
   */
  editListDescription(listId: string, newDescription: string): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(`List ${listId} not found for editing description`);
      return;
    }

    const meta = doc.getMap('meta') as YjsListMetadata;
    meta.set('description', newDescription);
    this.updateTimestamp(listId);
    this.logger.infoSync(
      `Edited description of list ${listId} to: ${newDescription}`
    );
  }

  /**
   * Clear all completed items from a list
   */
  clearCompletedItems(listId: string): void {
    const doc = this.documents.get(listId);
    if (!doc) {
      this.logger.warnSync(
        `List ${listId} not found for clearing completed items`
      );
      return;
    }

    const items = doc.getArray('items') as Y.Array<YjsListItemData>;
    let deletedCount = 0;

    // Iterate backwards to avoid index shifting issues when deleting items
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items.get(i);
      if (item && item.isCompleted) {
        items.delete(i, 1);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.updateTimestamp(listId);
      this.logger.infoSync(
        `Cleared ${deletedCount} completed items from list ${listId}`
      );
    } else {
      this.logger.debugSync(`No completed items found in list ${listId}`);
    }
  }

  clearAllState(): void {
    for (const [, doc] of this.documents) {
      doc.destroy();
    }
    this.documents.clear();
    this.logger.infoSync('Cleared all YJS documents');
  }
}
