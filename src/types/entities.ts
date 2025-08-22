/**
 * Entity type definitions for the storage system
 */

export interface List {
  uuid: string;
  data: Uint8Array;
}

export interface Metadata {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: Record<string, any>;
}

export interface SyncQueue {
  uuid: string;
  listUUID: string;
  operationType: 'YJS_UPDATE' | 'LIST_CREATE' | 'LIST_DELETE' | 'LIST_LEAVE';
  data: Uint8Array | null; // null for LIST_DELETE and LIST_LEAVE, Uint8Array for others
  addedDate: Date;
}
