import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ILocalStorage } from '@/services/interfaces/ILocalStorage';

/**
 * IndexedDB database schema
 */
interface AppDatabase extends DBSchema {
  lists: {
    key: string;
    value: {
      uuid: string;
      data: Uint8Array;
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: Record<string, any>;
    };
  };
  syncQueue: {
    key: string;
    value: {
      uuid: string;
      listUUID: string;
      data: Uint8Array;
      addedDate: Date;
    };
  };
}

/**
 * IndexedDB storage implementation
 */
export class IndexedDBStorage<T> implements ILocalStorage<T> {
  private db: IDBPDatabase<AppDatabase> | null = null;
  private storeName: 'lists' | 'metadata' | 'syncQueue';
  private dbName: string;
  private version: number;

  constructor(
    storeName: 'lists' | 'metadata' | 'syncQueue',
    dbName = 'ListAppDB',
    version = 1
  ) {
    this.storeName = storeName;
    this.dbName = dbName;
    this.version = version;
  }

  private async getDB(): Promise<IDBPDatabase<AppDatabase>> {
    if (!this.db) {
      this.db = await openDB<AppDatabase>(this.dbName, this.version, {
        upgrade(db: IDBPDatabase<AppDatabase>) {
          // Create object stores
          if (!db.objectStoreNames.contains('lists')) {
            db.createObjectStore('lists', { keyPath: 'uuid' });
          }
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('syncQueue')) {
            db.createObjectStore('syncQueue', { keyPath: 'uuid' });
          }
        },
      });
    }
    return this.db;
  }

  async get(id: string): Promise<T | null> {
    const db = await this.getDB();
    const result = await db.get(this.storeName, id);
    return result as T | null;
  }

  async getAll(): Promise<T[]> {
    const db = await this.getDB();
    const results = await db.getAll(this.storeName);
    return results as T[];
  }

  async save(item: T): Promise<void> {
    const db = await this.getDB();
    await db.put(
      this.storeName,
      item as AppDatabase[typeof this.storeName]['value']
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(this.storeName, id);
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    await db.clear(this.storeName);
  }
}
