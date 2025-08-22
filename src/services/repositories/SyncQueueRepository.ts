import { SyncQueue } from '@/types/entities';
import { ILocalStorage } from '@/services/interfaces/ILocalStorage';
import { generateUUID } from '@/utils/uuid';

/**
 * Repository for managing SyncQueue entities
 */
export class SyncQueueRepository {
  private storage: ILocalStorage<SyncQueue>;

  constructor(storage: ILocalStorage<SyncQueue>) {
    this.storage = storage;
  }

  /**
   * Get a sync queue item by UUID
   */
  async getSyncQueueItem(uuid: string): Promise<SyncQueue | null> {
    return this.storage.get(uuid);
  }

  /**
   * Get all sync queue items
   */
  async getAllSyncQueueItems(): Promise<SyncQueue[]> {
    return this.storage.getAll();
  }

  /**
   * Save a sync queue item (create or update)
   */
  async saveSyncQueueItem(item: SyncQueue): Promise<void> {
    await this.storage.save(item);
  }

  /**
   * Delete a sync queue item by UUID
   */
  async deleteSyncQueueItem(uuid: string): Promise<void> {
    await this.storage.delete(uuid);
  }

  /**
   * Clear all sync queue items
   */
  async clearAllSyncQueueItems(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Get sync queue items for a specific list
   */
  async getSyncQueueItemsForList(listUUID: string): Promise<SyncQueue[]> {
    const allItems = await this.getAllSyncQueueItems();
    return allItems.filter(item => item.listUUID === listUUID);
  }

  /**
   * Get sync queue items added after a specific date
   */
  async getSyncQueueItemsAfterDate(date: Date): Promise<SyncQueue[]> {
    const allItems = await this.getAllSyncQueueItems();
    return allItems.filter(item => item.addedDate > date);
  }

  /**
   * Add a new sync queue item
   */
  async addSyncQueueItem(
    listUUID: string,
    data: Uint8Array | null,
    operationType:
      | 'YJS_UPDATE'
      | 'LIST_CREATE'
      | 'LIST_DELETE'
      | 'LIST_LEAVE' = 'YJS_UPDATE'
  ): Promise<SyncQueue> {
    const now = new Date();
    const item: SyncQueue = {
      uuid: generateUUID(),
      listUUID,
      operationType,
      data,
      addedDate: new Date(now.getTime() - now.getTimezoneOffset() * 60000),
    };
    await this.saveSyncQueueItem(item);
    return item;
  }

  /**
   * Add a YJS update to sync queue
   */
  async addYjsUpdateItem(
    listUUID: string,
    data: Uint8Array
  ): Promise<SyncQueue> {
    return this.addSyncQueueItem(listUUID, data, 'YJS_UPDATE');
  }

  /**
   * Add a list creation to sync queue
   */
  async addListCreateItem(listUUID: string): Promise<SyncQueue> {
    return this.addSyncQueueItem(listUUID, null, 'LIST_CREATE');
  }

  /**
   * Add a list deletion to sync queue
   */
  async addListDeleteItem(listUUID: string): Promise<SyncQueue> {
    return this.addSyncQueueItem(listUUID, null, 'LIST_DELETE');
  }

  /**
   * Add a list leave to sync queue
   */
  async addListLeaveItem(listUUID: string): Promise<SyncQueue> {
    return this.addSyncQueueItem(listUUID, null, 'LIST_LEAVE');
  }

  /**
   * Clear all sync queue items for a specific list
   */
  async clearSyncQueueItemsForList(listUUID: string): Promise<void> {
    const itemsForList = await this.getSyncQueueItemsForList(listUUID);

    // Delete each item for this list
    for (const item of itemsForList) {
      await this.deleteSyncQueueItem(item.uuid);
    }
  }
}
