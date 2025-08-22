export interface RealtimeUpdate {
  type: 'list_created' | 'list_updated' | 'list_deleted';
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldRecord?: any;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface CRDTRealtimeUpdate extends RealtimeUpdate {
  record: CRDTRecord;
}

type CRDTRecord = {
  client_id: string;
  created_at: string;
  id: string;
  update_data: number[];
  user_id: string;
  yjs_document_id: string;
};

export interface CRDTUpdate {
  schema: 'public';
  table: 'crdt_updates';
  commit_timestamp: string;
  eventType: 'INSERT';
  new: CRDTRecord;
}

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface IRealtimeService {
  // Connection management
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Subscription management
  subscribeToListUpdates(
    callback: (update: RealtimeUpdate) => void
  ): Promise<RealtimeSubscription>;

  subscribeToCRDTUpdates(
    callback: (update: CRDTRealtimeUpdate) => void
  ): Promise<RealtimeSubscription>;

  // Connection change listeners
  onConnectionChange(callback: (connected: boolean) => void): void;
  removeConnectionListener(callback: (connected: boolean) => void): void;

  // Utility
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' | 'error';
}
