import { IRemoteStorageService } from '@/services/interfaces/IRemoteStorageService';
import { ILogService } from '@/services/interfaces/ILogService';
import { ListController } from '@/services/controllers/ListController';
import { ConnectionMonitor } from '@/services/implementations/connection/ConnectionMonitor';
import { SyncQueue } from '@/types/entities';

export class BackgroundSyncService {
  private static instance: BackgroundSyncService | null = null;
  private isRunning = false;
  private isStarted = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 5000; // 5 seconds
  private readonly MAX_BACKOFF_MS = 30000; // 30 seconds max backoff
  private currentBackoffMs = this.SYNC_INTERVAL_MS;
  private consecutiveEmptyRuns = 0;
  private connectionChangeListener:
    | ((state: { isOnline: boolean }) => void)
    | null = null;
  private connectionChangeTimeout: NodeJS.Timeout | null = null;
  private isProcessingConnectionChange = false;

  private constructor(
    private listController: ListController,
    private remoteStorageService: IRemoteStorageService,
    private logger: ILogService,
    private connectionMonitor: ConnectionMonitor
  ) {}

  /**
   * Get singleton instance
   */
  static getInstance(
    listController: ListController,
    remoteStorageService: IRemoteStorageService,
    logger: ILogService,
    connectionMonitor: ConnectionMonitor
  ): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService(
        listController,
        remoteStorageService,
        logger,
        connectionMonitor
      );
    }
    return BackgroundSyncService.instance;
  }

  /**
   * Start the background sync process (lazy initialization)
   * This will only start if there are items in the sync queue
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.infoSync('Background sync service is already started');
      return;
    }

    this.isStarted = true;
    this.logger.infoSync('Background sync service started (lazy mode)');

    // Set up connection monitoring
    this.setupConnectionMonitoring();

    // Check if there are items in the queue and start if needed
    await this.checkAndStartSync();
  }

  /**
   * Check if there are items in the sync queue and start processing if needed
   */
  async checkAndStartSync(): Promise<void> {
    // Prevent multiple simultaneous calls
    if (this.isRunning) {
      this.logger.debugSync('Sync service already running, skipping check');
      return;
    }

    try {
      const syncQueueItems = await this.listController.getSyncQueueItems();

      if (syncQueueItems.length > 0) {
        this.logger.infoSync(
          `Found ${syncQueueItems.length} items in sync queue, starting sync service`
        );
        this.startSyncLoop();
      } else {
        this.logger.debugSync(
          'No items in sync queue, sync service will remain idle'
        );
      }
    } catch (error) {
      this.logger.errorSync('Error checking sync queue:', error);
    }
  }

  /**
   * Start the actual sync loop
   */
  private startSyncLoop(): void {
    if (this.isRunning) {
      this.logger.debugSync(
        'Background sync service is already running, skipping start'
      );
      return;
    }

    this.isRunning = true;
    this.logger.infoSync('Starting background sync loop');

    // Reset backoff when starting
    this.currentBackoffMs = this.SYNC_INTERVAL_MS;
    this.consecutiveEmptyRuns = 0;

    // Start the sync interval
    this.syncInterval = setInterval(() => {
      this.processSyncQueue().catch(error => {
        this.logger.errorSync('Error in background sync:', error);
      });
    }, this.currentBackoffMs);

    // Process immediately
    this.processSyncQueue().catch(error => {
      this.logger.errorSync('Error in initial sync:', error);
    });
  }

  /**
   * Stop the sync loop (but keep the service started for future queue items)
   */
  private stopSyncLoop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.logger.infoSync(
      'Stopping background sync loop (service remains started)'
    );

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Stop the background sync process completely
   */
  stop(): void {
    if (!this.isStarted) {
      this.logger.infoSync('Background sync service is not started');
      return;
    }

    this.isStarted = false;
    this.logger.infoSync('Stopping background sync service completely');

    // Stop the sync loop
    this.stopSyncLoop();

    // Remove connection monitoring
    this.teardownConnectionMonitoring();

    // Reset state
    this.currentBackoffMs = this.SYNC_INTERVAL_MS;
    this.consecutiveEmptyRuns = 0;
    this.isProcessingConnectionChange = false;
  }

  /**
   * Set up connection monitoring to pause/resume sync based on connection state
   */
  private setupConnectionMonitoring(): void {
    this.connectionChangeListener = state => {
      // Debounce connection changes to prevent multiple rapid calls
      if (this.connectionChangeTimeout) {
        clearTimeout(this.connectionChangeTimeout);
      }

      this.connectionChangeTimeout = setTimeout(() => {
        this.handleConnectionChange(state);
      }, 500); // 500ms debounce
    };

    this.connectionMonitor.onConnectionChange(this.connectionChangeListener);
  }

  /**
   * Handle connection state changes with proper debouncing
   */
  private async handleConnectionChange(state: {
    isOnline: boolean;
  }): Promise<void> {
    if (this.isProcessingConnectionChange) {
      this.logger.debugSync('Already processing connection change, skipping');
      return;
    }

    this.isProcessingConnectionChange = true;

    try {
      if (state.isOnline && this.isStarted && !this.isRunning) {
        // Connection restored and we have items to sync
        this.logger.infoSync(
          'Connection restored, checking for sync queue items'
        );
        await this.checkAndStartSync();
      } else if (!state.isOnline && this.isRunning) {
        // Connection lost, pause sync
        this.logger.infoSync('Connection lost, pausing sync service');
        this.stopSyncLoop();
      }
    } catch (error) {
      this.logger.errorSync('Error handling connection change:', error);
    } finally {
      this.isProcessingConnectionChange = false;
    }
  }

  /**
   * Remove connection monitoring
   */
  private teardownConnectionMonitoring(): void {
    if (this.connectionChangeTimeout) {
      clearTimeout(this.connectionChangeTimeout);
      this.connectionChangeTimeout = null;
    }

    if (this.connectionChangeListener) {
      this.connectionMonitor.removeConnectionListener(
        this.connectionChangeListener
      );
      this.connectionChangeListener = null;
    }
  }

  /**
   * Process the sync queue with smart backoff
   */
  private async processSyncQueue(): Promise<void> {
    try {
      // Check if we're online before processing
      if (!this.connectionMonitor.isOnline()) {
        this.logger.debugSync('Offline, skipping sync queue processing');
        return;
      }

      this.logger.infoSync('Processing sync queue...');

      // Get all sync queue items
      const syncQueueItems = await this.listController.getSyncQueueItems();

      if (syncQueueItems.length === 0) {
        this.logger.debugSync('No sync queue items to process');
        this.handleEmptyQueue();
        return;
      }

      // Reset backoff on successful processing
      this.consecutiveEmptyRuns = 0;
      this.currentBackoffMs = this.SYNC_INTERVAL_MS;

      this.logger.infoSync(
        `Processing ${syncQueueItems.length} sync queue items`
      );

      // Group operations by list ID
      const operationsByList = this.groupOperationsByList(syncQueueItems);

      // Process each list's operations
      for (const [listId, operations] of operationsByList) {
        try {
          await this.processListOperations(listId, operations);
        } catch (error) {
          this.logger.errorSync(
            `Failed to process operations for list ${listId}:`,
            error
          );
          // Continue with next list instead of failing the entire batch
        }
      }

      this.logger.infoSync('Finished processing sync queue');

      // Check if queue is now empty and stop if so
      const remainingItems = await this.listController.getSyncQueueItems();
      if (remainingItems.length === 0) {
        this.logger.infoSync('Sync queue is now empty, stopping sync loop');
        this.stopSyncLoop();
      }
    } catch (error) {
      this.logger.errorSync('Error processing sync queue:', error);
      throw error;
    }
  }

  /**
   * Handle empty queue with exponential backoff
   */
  private handleEmptyQueue(): void {
    this.consecutiveEmptyRuns++;

    // If we've had many empty runs, increase backoff
    if (this.consecutiveEmptyRuns > 3) {
      this.currentBackoffMs = Math.min(
        this.currentBackoffMs * 1.5,
        this.MAX_BACKOFF_MS
      );
      this.logger.debugSync(
        `Empty queue run ${this.consecutiveEmptyRuns}, increasing backoff to ${this.currentBackoffMs}ms`
      );
    }

    // If we've had too many empty runs, stop the sync loop
    if (this.consecutiveEmptyRuns > 10) {
      this.logger.infoSync('Too many empty queue runs, stopping sync loop');
      this.stopSyncLoop();
    }
  }

  /**
   * Group sync queue items by list ID
   */
  private groupOperationsByList(
    syncQueueItems: SyncQueue[]
  ): Map<string, SyncQueue[]> {
    const operationsByList = new Map<string, SyncQueue[]>();

    for (const item of syncQueueItems) {
      if (!operationsByList.has(item.listUUID)) {
        operationsByList.set(item.listUUID, []);
      }
      operationsByList.get(item.listUUID)!.push(item);
    }

    return operationsByList;
  }

  /**
   * Process operations for a specific list with smart optimization
   */
  private async processListOperations(
    listId: string,
    operations: SyncQueue[]
  ): Promise<void> {
    this.logger.infoSync(
      `Processing ${operations.length} operations for list ${listId}`
    );

    // Sort operations by priority: LIST_CREATE first, then YJS_UPDATE, then LIST_DELETE
    const sortedOps = operations.sort((a, b) => {
      // First, sort by operation type priority
      const typePriority = {
        LIST_CREATE: 1,
        YJS_UPDATE: 2,
        LIST_DELETE: 3,
        LIST_LEAVE: 4,
      };

      const aPriority = typePriority[a.operationType];
      const bPriority = typePriority[b.operationType];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same type, sort by timestamp
      return a.addedDate.getTime() - b.addedDate.getTime();
    });

    this.logger.infoSync(
      `Sorted operations for list ${listId}:`,
      sortedOps.map(op => `${op.operationType} (${op.uuid})`)
    );

    // Optimize operations
    const optimizedOps = this.optimizeOperations(sortedOps);

    this.logger.infoSync(
      `Optimized ${operations.length} operations to ${optimizedOps.length} for list ${listId}`
    );

    // Process optimized operations
    for (const op of optimizedOps) {
      try {
        await this.processSyncQueueItem(op);
      } catch (error) {
        this.logger.errorSync(
          `Failed to process optimized operation ${op.uuid} for list ${listId}:`,
          error
        );
        throw error; // Stop processing this list if an operation fails
      }
    }
  }

  /**
   * Optimize operations by removing unnecessary ones
   */
  private optimizeOperations(operations: SyncQueue[]): SyncQueue[] {
    const optimized: SyncQueue[] = [];
    let hasDelete = false;

    for (const op of operations) {
      if (op.operationType === 'LIST_DELETE') {
        // If we have a delete, ignore everything else
        this.logger.infoSync(
          `Optimizing: Found DELETE operation, removing ${optimized.length} previous operations`
        );
        optimized.length = 0; // Clear all previous operations
        optimized.push(op);
        hasDelete = true;
        break;
      } else if (op.operationType === 'LIST_CREATE') {
        optimized.push(op);
      } else if (op.operationType === 'YJS_UPDATE') {
        // Only add updates if we don't have a delete
        if (!hasDelete) {
          optimized.push(op);
        } else {
          this.logger.infoSync(
            `Optimizing: Skipping YJS_UPDATE ${op.uuid} because DELETE operation exists`
          );
        }
      }
    }

    return optimized;
  }

  /**
   * Process a single sync queue item
   */
  private async processSyncQueueItem(item: SyncQueue): Promise<void> {
    try {
      this.logger.infoSync(
        `Processing sync queue item: ${item.uuid} (${item.operationType})`
      );

      switch (item.operationType) {
        case 'YJS_UPDATE':
          await this.processYjsUpdate(item);
          break;
        case 'LIST_CREATE':
          await this.processListCreate(item);
          break;
        case 'LIST_DELETE':
          await this.processListDelete(item);
          break;
        case 'LIST_LEAVE':
          await this.processListLeave(item);
          break;
        default:
          throw new Error(`Unknown operation type: ${item.operationType}`);
      }

      // Remove the item from sync queue after successful processing
      await this.listController.removeSyncQueueItem(item.uuid);

      this.logger.infoSync(
        `Successfully processed sync queue item: ${item.uuid} (${item.operationType})`
      );
    } catch (error) {
      this.logger.errorSync(
        `Failed to process sync queue item ${item.uuid}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Process a YJS update
   */
  private async processYjsUpdate(item: SyncQueue): Promise<void> {
    if (!item.data) {
      throw new Error('YJS update item must have data');
    }

    this.logger.infoSync(
      `Pushing YJS update to remote storage: ${item.uuid} for list: ${item.listUUID}`
    );

    // Get client ID for this update
    const clientId = await this.listController.getClientId();

    // Send the update to remote storage
    await this.remoteStorageService.pushUpdate(item.listUUID, {
      id: item.uuid,
      yjsDocumentId: item.listUUID,
      clientId: clientId,
      data: item.data,
      timestamp: item.addedDate,
    });

    this.logger.infoSync(
      `Successfully pushed YJS update to remote storage: ${item.uuid}`
    );
  }

  /**
   * Process a list creation
   */
  private async processListCreate(item: SyncQueue): Promise<void> {
    this.logger.infoSync(`Creating list in remote storage: ${item.listUUID}`);
    // Create the list in remote storage
    await this.remoteStorageService.createList(item.listUUID);
    this.logger.infoSync(
      `Successfully created list in remote storage: ${item.listUUID}`
    );
  }

  /**
   * Process a list deletion
   */
  private async processListDelete(item: SyncQueue): Promise<void> {
    // Delete the list from remote storage
    await this.remoteStorageService.deleteList(item.listUUID);
  }

  /**
   * Process a list leave operation
   */
  private async processListLeave(item: SyncQueue): Promise<void> {
    // Remove the user as a participant from the list
    await this.remoteStorageService.removeParticipant(item.listUUID);
  }

  /**
   * Force a sync now (for manual sync)
   */
  async forceSync(): Promise<void> {
    this.logger.infoSync('Forcing sync...');
    await this.processSyncQueue();
  }

  /**
   * Trigger sync when items are added to the queue
   * This is called by the ListController when items are added
   */
  async triggerSync(): Promise<void> {
    if (!this.isStarted) {
      this.logger.debugSync('Sync service not started, ignoring trigger');
      return;
    }

    if (!this.connectionMonitor.isOnline()) {
      this.logger.debugSync('Offline, ignoring sync trigger');
      return;
    }

    if (!this.isRunning) {
      this.logger.infoSync('Items added to sync queue, starting sync service');
      await this.checkAndStartSync();
    } else {
      this.logger.debugSync(
        'Sync service already running, will process new items on next cycle'
      );
    }
  }

  /**
   * Check if the service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if the service is started
   */
  isServiceStarted(): boolean {
    return this.isStarted;
  }
}
