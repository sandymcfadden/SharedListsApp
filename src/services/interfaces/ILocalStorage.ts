/**
 * Generic storage interface for abstracting storage operations
 */
export interface ILocalStorage<T> {
  /**
   * Get a single item by its identifier
   */
  get(id: string): Promise<T | null>;

  /**
   * Get all items from storage
   */
  getAll(): Promise<T[]>;

  /**
   * Save an item to storage (create or update)
   */
  save(item: T): Promise<void>;

  /**
   * Delete an item by its identifier
   */
  delete(id: string): Promise<void>;

  /**
   * Clear all items from storage
   */
  clear(): Promise<void>;
}
