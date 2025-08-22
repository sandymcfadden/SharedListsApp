import { SupabaseClient } from '@supabase/supabase-js';
import {
  IRealtimeService,
  RealtimeUpdate,
  RealtimeSubscription,
  CRDTUpdate,
  CRDTRealtimeUpdate,
} from '@/services/interfaces/IRealtimeService';
import { ILogService } from '@/services/interfaces/ILogService';
import { SupabaseClientSingleton } from '@/services/implementations/auth/SupabaseClient';

export class SupabaseRealtimeService implements IRealtimeService {
  private supabase: SupabaseClient;
  private logger: ILogService;
  private connectionStatus:
    | 'connected'
    | 'disconnected'
    | 'connecting'
    | 'error' = 'disconnected';
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private errorTimeout: number | null = null;
  private connectionListeners: Array<(connected: boolean) => void> = [];

  // Track subscription states to avoid multiple connection notifications
  private subscriptionStates: Map<
    string,
    'subscribing' | 'subscribed' | 'error'
  > = new Map();
  private hasNotifiedConnection = false;

  constructor(supabaseUrl: string, supabaseKey: string, logger: ILogService) {
    this.supabase = SupabaseClientSingleton.getInstance(
      supabaseUrl,
      supabaseKey
    );
    this.logger = logger;
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.infoSync('Disconnecting from Supabase realtime...');

      // Clear the error timeout
      if (this.errorTimeout) {
        clearTimeout(this.errorTimeout);
        this.errorTimeout = null;
      }

      // Unsubscribe from all subscriptions
      for (const [key, subscription] of this.subscriptions) {
        subscription.unsubscribe();
        this.logger.infoSync(`Unsubscribed from ${key}`);
      }
      this.subscriptions.clear();
      this.subscriptionStates.clear();
      this.hasNotifiedConnection = false;

      this.connectionStatus = 'disconnected';
      this.logger.infoSync('Disconnected from Supabase realtime');
      // Notify connection listeners
      this.notifyConnectionListeners(false);
    } catch (error) {
      this.logger.errorSync(
        'Error disconnecting from Supabase realtime:',
        error
      );
      throw error;
    }
  }

  isConnected(): boolean {
    const connected = this.connectionStatus === 'connected';
    this.logger.debugSync(
      `Realtime service isConnected(): ${connected} (status: ${this.connectionStatus})`
    );
    return connected;
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
  }

  removeConnectionListener(callback: (connected: boolean) => void): void {
    const index = this.connectionListeners.indexOf(callback);
    if (index > -1) {
      this.connectionListeners.splice(index, 1);
    }
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' | 'error' {
    // If we have active subscriptions, we're connected
    if (this.subscriptions.size > 0 && this.connectionStatus === 'connected') {
      return 'connected';
    }
    // If we're connecting but have no subscriptions yet, stay connecting
    if (this.connectionStatus === 'connecting') {
      return 'connecting';
    }
    // If we have subscriptions but status is error, give it a chance to recover
    if (this.subscriptions.size > 0 && this.connectionStatus === 'error') {
      // If we have subscriptions, we might be in a recovery state
      // Check if any subscriptions are actually working
      return 'connecting'; // Show as connecting while we wait for recovery
    }
    return this.connectionStatus;
  }

  /**
   * Check if all subscriptions are ready and notify connection listeners once
   */
  private checkAndNotifyConnectionStatus(): void {
    const allSubscribed = Array.from(this.subscriptionStates.values()).every(
      state => state === 'subscribed'
    );

    if (allSubscribed && !this.hasNotifiedConnection) {
      this.connectionStatus = 'connected';
      this.hasNotifiedConnection = true;
      this.logger.infoSync(
        'All subscriptions ready - notifying connection listeners'
      );
      this.notifyConnectionListeners(true);
    }
  }

  /**
   * Notify connection listeners of status change
   */
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        this.logger.errorSync('Error in connection listener:', error);
      }
    });
  }

  private async setAuth(): Promise<void> {
    const {
      data: { session },
      error,
    } = await this.supabase.auth.getSession();
    if (error) {
      this.logger.errorSync('Error getting session:', error);
      throw error;
    }
    if (!session?.access_token) {
      this.logger.errorSync('No access token found');
      throw new Error('No access token found');
    }
    this.logger.infoSync('Access token found:', session.access_token);
    await this.supabase.realtime.setAuth(session.access_token);
  }

  async subscribeToCRDTUpdates(
    callback: (update: CRDTRealtimeUpdate) => void
  ): Promise<RealtimeSubscription> {
    await this.setAuth();
    const table = 'crdt_updates'; // CRDT subscription
    this.logger.infoSync(`Starting CRDT subscription to table: ${table}`);
    this.subscriptionStates.set(table, 'subscribing');
    try {
      const channel = this.supabase
        .channel(`${table}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: `${table}`,
          },
          payload => {
            const remoteUpdate = payload as unknown as CRDTUpdate;
            this.logger.debugSync(
              `Received realtime update for ${table}:`,
              payload
            );

            const update: CRDTRealtimeUpdate = {
              type: 'list_updated',
              table: table,
              record: remoteUpdate.new,
              eventType: remoteUpdate.eventType,
            };

            callback(update);
          }
        )
        .subscribe(status => {
          this.logger.infoSync(`Subscription status for ${table}:`, status);
          if (status === 'SUBSCRIBED') {
            this.subscriptionStates.set(table, 'subscribed');
            // Clear the error timeout since we're now connected
            if (this.errorTimeout) {
              clearTimeout(this.errorTimeout);
              this.errorTimeout = null;
            }
            this.logger.infoSync(`Successfully subscribed to ${table}`);
            // Check if all subscriptions are ready before notifying
            this.checkAndNotifyConnectionStatus();
          } else if (status === 'CHANNEL_ERROR') {
            this.subscriptionStates.set(table, 'error');
            // Don't immediately set error status for CHANNEL_ERROR
            // This might be a temporary issue during connection
            this.logger.warnSync(
              `Channel error for ${table}, but keeping current status: ${this.connectionStatus}`
            );
            // Only set error if we've been trying for a while and still failing
            // For now, let's be more patient and not immediately set error status
          } else if (status === 'TIMED_OUT') {
            this.subscriptionStates.set(table, 'error');
            this.logger.warnSync(
              `Subscription timed out for ${table}, status: ${status}`
            );
          } else if (status === 'CLOSED') {
            this.subscriptionStates.set(table, 'error');
            this.logger.warnSync(
              `Subscription closed for ${table}, status: ${status}`
            );
          } else {
            this.logger.infoSync(`Subscription status for ${table}: ${status}`);
          }
        });

      const subscription: RealtimeSubscription = {
        unsubscribe: () => {
          this.logger.infoSync(`Unsubscribing from table: ${table}`);
          this.supabase.removeChannel(channel);
          this.subscriptions.delete(table);
          this.subscriptionStates.delete(table);
        },
      };

      this.subscriptions.set(table, subscription);
      return subscription;
    } catch (error) {
      this.logger.errorSync(`Failed to subscribe to table ${table}:`, error);
      throw error;
    }
  }

  async subscribeToListUpdates(
    callback: (update: RealtimeUpdate) => void
  ): Promise<RealtimeSubscription> {
    await this.setAuth();
    const table = 'lists';
    this.subscriptionStates.set(table, 'subscribing');
    try {
      const channel = this.supabase
        .channel(`${table}_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
          },
          payload => {
            this.logger.debugSync(
              `Received realtime update for ${table}:`,
              payload
            );

            const update: RealtimeUpdate = {
              type: this.determineUpdateType(table, payload.eventType),
              table: table,
              record: payload.new,
              oldRecord: payload.old,
              eventType: payload.eventType,
            };

            callback(update);
          }
        )
        .subscribe(status => {
          this.logger.infoSync(`Subscription status for ${table}:`, status);
          if (status === 'SUBSCRIBED') {
            this.subscriptionStates.set(table, 'subscribed');
            // Clear the error timeout since we're now connected
            if (this.errorTimeout) {
              clearTimeout(this.errorTimeout);
              this.errorTimeout = null;
            }
            this.logger.infoSync(`Successfully subscribed to ${table}`);
            // Check if all subscriptions are ready before notifying
            this.checkAndNotifyConnectionStatus();
          } else if (status === 'CHANNEL_ERROR') {
            this.subscriptionStates.set(table, 'error');
            // Don't immediately set error status for CHANNEL_ERROR
            // This might be a temporary issue during connection
            this.logger.warnSync(
              `Channel error for ${table}, but keeping current status: ${this.connectionStatus}`
            );
            // Only set error if we've been trying for a while and still failing
            // For now, let's be more patient and not immediately set error status
          } else if (status === 'TIMED_OUT') {
            this.subscriptionStates.set(table, 'error');
            this.logger.warnSync(
              `Subscription timed out for ${table}, status: ${status}`
            );
          } else if (status === 'CLOSED') {
            this.subscriptionStates.set(table, 'error');
            this.logger.warnSync(
              `Subscription closed for ${table}, status: ${status}`
            );
          } else {
            this.logger.infoSync(`Subscription status for ${table}: ${status}`);
          }
        });

      const subscription: RealtimeSubscription = {
        unsubscribe: () => {
          this.logger.infoSync(`Unsubscribing from table: ${table}`);
          this.supabase.removeChannel(channel);
          this.subscriptions.delete(table);
          this.subscriptionStates.delete(table);
        },
      };

      this.subscriptions.set(table, subscription);
      return subscription;
    } catch (error) {
      this.logger.errorSync(`Failed to subscribe to table ${table}:`, error);
      throw error;
    }
  }

  private determineUpdateType(
    table: string,
    eventType: string
  ): RealtimeUpdate['type'] {
    switch (table) {
      case 'lists':
        switch (eventType) {
          case 'INSERT':
            return 'list_created';
          case 'UPDATE':
            return 'list_updated';
          case 'DELETE':
            return 'list_deleted';
          default:
            return 'list_updated';
        }
      default:
        return 'list_updated';
    }
  }
}
