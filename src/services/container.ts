import { IAuthService } from '@/services/interfaces/IAuthService';
import { IEventService } from '@/services/interfaces/IEventService';
import { ILocalStorage } from '@/services/interfaces/ILocalStorage';

import { IRemoteStorageService } from '@/services/interfaces/IRemoteStorageService';
import { ILogService } from '@/services/interfaces/ILogService';
import { IRealtimeService } from '@/services/interfaces/IRealtimeService';
import { IYjsListManager } from '@/services/interfaces/IYjsListManager';
import { List, Metadata, SyncQueue } from '@/types/entities';

// Import implementations

import { YjsListManager } from '@/services/implementations/yjs/YjsListManager';
import { EventService } from '@/services/implementations/events/EventService';
import { SupabaseAuthService } from '@/services/implementations/auth/SupabaseAuthService';

import { IndexedDBStorage } from '@/services/implementations/storage/IndexedDBStorage';
import { SupabaseRemoteStorageService } from '@/services/implementations/storage/SupabaseRemoteStorageService';

import { SupabaseRealtimeService } from '@/services/implementations/realtime/SupabaseRealtimeService';

import { ListController } from '@/services/controllers/ListController';
import { ConsoleLogService } from '@/services/implementations/logging/ConsoleLogService';
import { BackgroundSyncService } from '@/services/implementations/sync/BackgroundSyncService';
import { RemoteUpdateHandler } from '@/services/implementations/realtime/RemoteUpdateHandler';
import { ConnectionMonitor } from '@/services/implementations/connection/ConnectionMonitor';

// Import repositories
import { ListRepository } from '@/services/repositories/ListRepository';
import { MetadataRepository } from '@/services/repositories/MetadataRepository';
import { SyncQueueRepository } from '@/services/repositories/SyncQueueRepository';

// Import configuration
import { AppConfig, getConfig, validateConfig } from '@/services/config';

export class ServiceContainer {
  private static instance: ServiceContainer;
  private config: AppConfig;

  // Service instances
  private authServiceInstance?: IAuthService;
  private eventServiceInstance?: IEventService;
  private remoteStorageServiceInstance?: IRemoteStorageService;
  private realtimeServiceInstance?: IRealtimeService;

  private listControllerInstance?: ListController;
  private logServiceInstance?: ILogService;
  private yjsListManagerInstance?: IYjsListManager;
  private backgroundSyncServiceInstance?: BackgroundSyncService;
  private remoteUpdateHandlerInstance?: RemoteUpdateHandler;
  private connectionMonitorInstance?: ConnectionMonitor;

  // Repository instances
  private listRepositoryInstance?: ListRepository;
  private metadataRepositoryInstance?: MetadataRepository;
  private syncQueueRepositoryInstance?: SyncQueueRepository;

  private constructor() {
    this.config = getConfig();

    // Validate configuration
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      const logger = this.getLogService();
      logger.errorSync('Configuration validation errors:', errors);
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    // Expose to window for debugging in development
    if (
      typeof window !== 'undefined' &&
      import.meta.env.MODE === 'development'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).ServiceContainer = ServiceContainer;
    }
  }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  // Configuration
  getConfig(): AppConfig {
    return this.config;
  }

  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Reset instances that depend on config
    this.authServiceInstance = undefined;
    this.realtimeServiceInstance = undefined;
  }

  // Service getters with lazy initialization
  getAuthService(): IAuthService {
    if (!this.authServiceInstance) {
      switch (this.config.auth.type) {
        case 'supabase':
          if (!this.config.auth.url || !this.config.auth.apiKey) {
            throw new Error(
              'Supabase URL and API key are required for authentication'
            );
          }
          this.authServiceInstance = new SupabaseAuthService(
            this.config.auth.url,
            this.config.auth.apiKey,
            this.getLogService()
          );
          break;
        default:
          throw new Error(`Unsupported auth type: ${this.config.auth.type}`);
      }
    }

    return this.authServiceInstance;
  }

  getEventService(): IEventService {
    if (!this.eventServiceInstance) {
      // Use the unified EventService that handles both basic and events
      this.eventServiceInstance = new EventService(this.getLogService());
    }
    return this.eventServiceInstance;
  }

  getRemoteStorageService(): IRemoteStorageService {
    if (!this.remoteStorageServiceInstance) {
      switch (this.config.remoteStorage.type) {
        case 'supabase':
          if (!this.config.auth.url || !this.config.auth.apiKey) {
            throw new Error(
              'Supabase URL and API key are required for remote storage'
            );
          }
          this.remoteStorageServiceInstance = new SupabaseRemoteStorageService(
            this.config.auth.url,
            this.config.auth.apiKey,
            this.getLogService()
          );
          break;
        default:
          throw new Error(
            `Unsupported remote storage type: ${this.config.remoteStorage.type}`
          );
      }
    }

    return this.remoteStorageServiceInstance;
  }

  getRealtimeService(): IRealtimeService {
    if (!this.realtimeServiceInstance) {
      switch (this.config.realtime.type) {
        case 'supabase':
          if (!this.config.auth.url || !this.config.auth.apiKey) {
            throw new Error(
              'Supabase URL and API key are required for realtime service'
            );
          }
          this.realtimeServiceInstance = new SupabaseRealtimeService(
            this.config.auth.url,
            this.config.auth.apiKey,
            this.getLogService()
          );
          break;
        default:
          throw new Error(
            `Unsupported realtime type: ${this.config.realtime.type}`
          );
      }
    }

    return this.realtimeServiceInstance;
  }

  getLogService(): ILogService {
    if (!this.logServiceInstance) {
      switch (this.config.logging.type) {
        case 'console':
          this.logServiceInstance = new ConsoleLogService(
            this.config.logging.level
          );
          break;
        default:
          throw new Error(`Unsupported log type: ${this.config.logging.type}`);
      }
    }

    return this.logServiceInstance;
  }

  getYjsListManager(): IYjsListManager {
    if (!this.yjsListManagerInstance) {
      const logger = this.getLogService();
      this.yjsListManagerInstance = new YjsListManager(logger);
    }
    return this.yjsListManagerInstance;
  }

  getListController(): ListController {
    if (!this.listControllerInstance) {
      const yjsListManager = this.getYjsListManager();
      const eventService = this.getEventService();
      const logger = this.getLogService();
      const remoteStorageService = this.getRemoteStorageService();
      const connectionMonitor = this.getConnectionMonitor();

      // Get repository instances (they will use config to determine storage implementation)
      const listRepository = this.getListRepository();
      const syncQueueRepository = this.getSyncQueueRepository();
      const metadataRepository = this.getMetadataRepository();

      this.listControllerInstance = new ListController(
        yjsListManager,
        eventService,
        logger,
        remoteStorageService,
        connectionMonitor,
        listRepository,
        syncQueueRepository,
        metadataRepository
      );
    }
    return this.listControllerInstance;
  }

  getBackgroundSyncService(): BackgroundSyncService {
    if (!this.backgroundSyncServiceInstance) {
      const listController = this.getListController();
      const remoteStorageService = this.getRemoteStorageService();
      const logger = this.getLogService();
      const connectionMonitor = this.getConnectionMonitor();

      this.backgroundSyncServiceInstance = BackgroundSyncService.getInstance(
        listController,
        remoteStorageService,
        logger,
        connectionMonitor
      );
    }
    return this.backgroundSyncServiceInstance;
  }

  getRemoteUpdateHandler(): RemoteUpdateHandler {
    if (!this.remoteUpdateHandlerInstance) {
      const listController = this.getListController();
      const realtimeService = this.getRealtimeService();
      const logger = this.getLogService();

      this.remoteUpdateHandlerInstance = new RemoteUpdateHandler(
        listController,
        realtimeService,
        logger
      );
    }
    return this.remoteUpdateHandlerInstance;
  }

  getConnectionMonitor(): ConnectionMonitor {
    if (!this.connectionMonitorInstance) {
      const logger = this.getLogService();
      const realtimeService = this.getRealtimeService();

      this.connectionMonitorInstance = ConnectionMonitor.getInstance(
        logger,
        realtimeService
      );
    }
    return this.connectionMonitorInstance;
  }

  // Repository getters
  getListRepository(): ListRepository {
    if (!this.listRepositoryInstance) {
      const storage = this.createLocalStorage<List>('lists');
      this.listRepositoryInstance = new ListRepository(storage);
    }
    return this.listRepositoryInstance;
  }

  getMetadataRepository(): MetadataRepository {
    if (!this.metadataRepositoryInstance) {
      const storage = this.createLocalStorage<Metadata>('metadata');
      this.metadataRepositoryInstance = new MetadataRepository(storage);
    }
    return this.metadataRepositoryInstance;
  }

  getSyncQueueRepository(): SyncQueueRepository {
    if (!this.syncQueueRepositoryInstance) {
      const storage = this.createLocalStorage<SyncQueue>('syncQueue');
      this.syncQueueRepositoryInstance = new SyncQueueRepository(storage);
    }
    return this.syncQueueRepositoryInstance;
  }

  // Helper method to create localStorage instances based on config
  private createLocalStorage<T>(
    storeName: 'lists' | 'metadata' | 'syncQueue'
  ): ILocalStorage<T> {
    switch (this.config.localStorage.type) {
      case 'indexeddb':
        return new IndexedDBStorage<T>(storeName);
      default:
        throw new Error(
          `Unsupported localStorage type: ${this.config.localStorage.type}`
        );
    }
  }

  // Method to clear all data (for sign out)
  async clearAllData(): Promise<void> {
    try {
      const logger = this.getLogService();
      logger.infoSync('Starting to clear all local data...');

      const newListController = this.getListController();

      // Clear all data using the new controller
      await newListController.clearAllData();

      logger.infoSync('Cleared all local data');

      // Reset all service instances immediately
      this.reset();
    } catch (error) {
      const logger = this.getLogService();
      logger.errorSync('Error during sign out:', error);
      throw error;
    }
  }

  // Reset all service instances (for sign out)
  reset(): void {
    const logger = this.getLogService();
    logger.infoSync('Resetting all service instances...');
    this.authServiceInstance = undefined;
    this.eventServiceInstance = undefined;
    this.remoteStorageServiceInstance = undefined;
    this.realtimeServiceInstance = undefined;

    this.listControllerInstance = undefined;
    this.logServiceInstance = undefined;
    this.yjsListManagerInstance = undefined;
    this.backgroundSyncServiceInstance = undefined;
    this.remoteUpdateHandlerInstance = undefined;
    this.connectionMonitorInstance = undefined;

    // Reset repository instances
    this.listRepositoryInstance = undefined;
    this.metadataRepositoryInstance = undefined;
    this.syncQueueRepositoryInstance = undefined;

    logger.infoSync('All service instances reset');
  }

  // Method to attempt cleanup of leftover databases (for auth page load)
  async cleanupLeftoverDatabases(): Promise<void> {
    try {
      const logger = this.getLogService();
      logger.infoSync('Attempting to clean up leftover databases...');

      // Try to clear sync metadata using list controller
      try {
        const listController = this.getListController();
        await listController.clearAllData();
        logger.infoSync('Successfully cleared leftover sync metadata');
      } catch (error) {
        logger.infoSync(
          'Could not clear sync metadata (may not exist or be in use):',
          error
        );
      }

      logger.infoSync('Completed leftover database cleanup attempt');
    } catch (error) {
      const logger = this.getLogService();
      logger.errorSync('Error during leftover database cleanup:', error);
      // Don't throw - this is just cleanup, not critical
    }
  }
}
