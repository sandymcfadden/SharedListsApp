import { Metadata } from '@/types/entities';
import { ILocalStorage } from '@/services/interfaces/ILocalStorage';

/**
 * Repository for managing Metadata entities
 */
export class MetadataRepository {
  private storage: ILocalStorage<Metadata>;

  constructor(storage: ILocalStorage<Metadata>) {
    this.storage = storage;
  }

  /**
   * Get metadata by key
   */
  async getMetadata(key: string): Promise<Metadata | null> {
    return this.storage.get(key);
  }

  /**
   * Get all metadata
   */
  async getAllMetadata(): Promise<Metadata[]> {
    return this.storage.getAll();
  }

  /**
   * Save metadata (create or update)
   */
  async saveMetadata(metadata: Metadata): Promise<void> {
    await this.storage.save(metadata);
  }

  /**
   * Delete metadata by key
   */
  async deleteMetadata(key: string): Promise<void> {
    await this.storage.delete(key);
  }

  /**
   * Clear all metadata
   */
  async clearAllMetadata(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Get metadata value by key
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getValue(key: string): Promise<Record<string, any> | null> {
    const metadata = await this.getMetadata(key);
    return metadata?.value || null;
  }

  /**
   * Set metadata value by key
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setValue(key: string, value: Record<string, any>): Promise<void> {
    const metadata: Metadata = { key, value };
    await this.saveMetadata(metadata);
  }
}
