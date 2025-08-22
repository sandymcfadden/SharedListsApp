export type SyncStatus = 'syncing' | 'synced' | 'offline';

export type BootstrapStatus = 'idle' | 'loading' | 'complete' | 'error';

export interface ConnectionState {
  browserOnline: boolean;
  realtimeConnected: boolean;
  isOnline: boolean;
}
