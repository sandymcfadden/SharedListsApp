import { List } from '@/types/entities';
import { ILocalStorage } from '@/services/interfaces/ILocalStorage';

/**
 * Repository for managing List entities
 */
export class ListRepository {
  private storage: ILocalStorage<List>;

  constructor(storage: ILocalStorage<List>) {
    this.storage = storage;
  }

  /**
   * Get a list by UUID
   */
  async getList(uuid: string): Promise<List | null> {
    return this.storage.get(uuid);
  }

  /**
   * Get all lists
   */
  async getAllLists(): Promise<List[]> {
    return this.storage.getAll();
  }

  /**
   * Save a list (create or update)
   */
  async saveList(list: List): Promise<void> {
    await this.storage.save(list);
  }

  /**
   * Delete a list by UUID
   */
  async deleteList(uuid: string): Promise<void> {
    await this.storage.delete(uuid);
  }

  /**
   * Clear all lists
   */
  async clearAllLists(): Promise<void> {
    await this.storage.clear();
  }
}
