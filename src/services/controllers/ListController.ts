import { IYjsListManager } from '@/services/interfaces/IYjsListManager';
import { IEventService } from '@/services/interfaces/IEventService';

import { ILogService } from '@/services/interfaces/ILogService';
import { IRemoteStorageService } from '@/services/interfaces/IRemoteStorageService';
import { ConnectionMonitor } from '@/services/implementations/connection/ConnectionMonitor';
import { EVENT_TYPES } from '@/types/EventTypes';

import { ListRepository } from '@/services/repositories/ListRepository';
import { SyncQueueRepository } from '@/services/repositories/SyncQueueRepository';
import { MetadataRepository } from '@/services/repositories/MetadataRepository';
import { SyncQueue } from '@/types/entities';
import { CollaborativeDocument } from '@/types/List';
import { generateUUID } from '@/utils/uuid';

// Sync metadata types
interface SyncState {
  yjsDocumentId: string;
  lastSyncTime?: Date;
  isOnline: boolean;
  pendingChangesCount: number;
}

export class ListController {
  private cachedClientId: string | null = null;
  private isBootstrapping = false;

  constructor(
    private yjsListManager: IYjsListManager,
    private eventService: IEventService,
    private logger: ILogService,
    private remoteStorageService: IRemoteStorageService,
    private connectionMonitor: ConnectionMonitor,
    private listRepository: ListRepository,
    private syncQueueRepository: SyncQueueRepository,
    private metadataRepository: MetadataRepository
  ) {}

  /**
   * Get the current user ID from the remote storage service
   */
  private async getCurrentUserId(): Promise<string | null> {
    // Access the userId from the remote storage service
    if (this.remoteStorageService.getUserId()) {
      return this.remoteStorageService.getUserId();
    }

    // Fallback: try to get it from auth service if available
    this.logger.warnSync('No user ID available in remote storage service');
    return null;
  }

  /**
   * Create a new list
   */
  async createList(name: string, description?: string): Promise<string> {
    try {
      const listId = generateUUID();
      const currentUserId = (await this.getCurrentUserId()) ?? undefined;

      // 1. Create YJS document with ownerId
      this.yjsListManager.createList(listId, name, description, currentUserId);

      // 2. Save initial state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });

        // 3. Try real-time sync if online, otherwise queue
        const connectionState = this.connectionMonitor.getConnectionState();
        this.logger.infoSync(`Connection state during list creation:`, {
          browserOnline: connectionState.browserOnline,
          realtimeConnected: connectionState.realtimeConnected,
          isOnline: connectionState.isOnline,
        });

        if (this.connectionMonitor.isOnline()) {
          try {
            this.logger.infoSync(
              `Attempting real-time sync for list creation: ${listId}`
            );

            // Create the list record in remote database
            await this.remoteStorageService.createList(listId);
            this.logger.infoSync(
              `Real-time sync successful for list creation ${listId}`
            );

            // Create the initial YJS update with the list's initial state
            const clientId = await this.getClientId();
            this.logger.infoSync(
              `Pushing initial YJS update for list: ${listId} with clientId: ${clientId}`
            );

            await this.remoteStorageService.pushUpdate(listId, {
              id: generateUUID(),
              yjsDocumentId: listId,
              clientId: clientId,
              data: yjsState,
              timestamp: new Date(),
            });
            this.logger.infoSync(
              `Real-time sync successful for initial YJS update ${listId}`
            );
            // Success, no need to queue - continue to emit event
          } catch (error) {
            this.logger.errorSync(
              `Real-time sync failed for list creation ${listId}:`,
              error
            );
            this.logger.warnSync(
              `Falling back to queue for list creation ${listId}`
            );
            // Fallback to queue
            await this.syncQueueRepository.addListCreateItem(listId);
            await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
            // Trigger sync service to process the queued items
            await this.triggerBackgroundSync();
          }
        } else {
          this.logger.infoSync(
            `Offline mode - queuing list creation: ${listId}`
          );
          // Offline - add to sync queue
          await this.syncQueueRepository.addListCreateItem(listId);
          await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      }

      // 4. Emit events for UI updates

      // Event for list creation
      this.eventService.publish({
        type: EVENT_TYPES.LIST_CREATED,
        payload: {
          listId: listId,
          title: name,
          createdAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(`Created new list: ${listId} with name: ${name}`);
      return listId;
    } catch (error) {
      this.logger.errorSync(`Failed to create list "${name}":`, error);
      throw error;
    }
  }

  /**
   * Delete a list
   */
  async deleteList(listId: string): Promise<void> {
    try {
      // 1. Delete from YJS manager
      this.yjsListManager.deleteList(listId);

      // 2. Delete from repositories
      await this.listRepository.deleteList(listId);

      // 3. Clear any existing sync queue items for this list
      await this.syncQueueRepository.clearSyncQueueItemsForList(listId);

      // 4. Try real-time sync if online, otherwise queue
      if (this.connectionMonitor.isOnline()) {
        try {
          await this.remoteStorageService.deleteList(listId);
          this.logger.infoSync(
            `Real-time sync successful for list deletion ${listId}`
          );
          // Success, no need to queue - continue to emit event
        } catch (error) {
          this.logger.warnSync(
            `Real-time sync failed for list deletion ${listId}, falling back to queue:`,
            error
          );
          // Fallback to queue
          await this.syncQueueRepository.addListDeleteItem(listId);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      } else {
        // Offline - add to sync queue
        await this.syncQueueRepository.addListDeleteItem(listId);
        // Trigger sync service to process the queued items
        await this.triggerBackgroundSync();
      }

      // 5. Emit events for UI updates

      // Event for list deletion
      this.eventService.publish({
        type: EVENT_TYPES.LIST_DELETED,
        payload: {
          listId: listId,
          title: '', // We don't have the title at this point, but it's not critical
          deletedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(`Deleted list: ${listId}`);
    } catch (error) {
      this.logger.errorSync(`Failed to delete list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Add an item to a list
   */
  async addItem(listId: string, text: string): Promise<void> {
    try {
      // 1. Add item to YJS document
      const itemId = this.yjsListManager.addItem(listId, text);
      if (!itemId) {
        throw new Error(`Failed to add item to list ${listId}`);
      }

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });

        // 3. Try real-time sync if online, otherwise queue
        if (this.connectionMonitor.isOnline()) {
          try {
            const clientId = await this.getClientId();
            await this.remoteStorageService.pushUpdate(listId, {
              id: generateUUID(),
              yjsDocumentId: listId,
              clientId: clientId,
              data: yjsState,
              timestamp: new Date(),
            });
            this.logger.infoSync(
              `Real-time sync successful for item add to list ${listId}`
            );
            // Success, no need to queue - continue to emit event
          } catch (error) {
            this.logger.warnSync(
              `Real-time sync failed for item add to list ${listId}, falling back to queue:`,
              error
            );
            // Fallback to queue
            await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
            // Trigger sync service to process the queued items
            await this.triggerBackgroundSync();
          }
        } else {
          // Offline - add to sync queue
          await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      }

      // 4. Emit events for UI updates

      // Event for item addition
      this.eventService.publish({
        type: EVENT_TYPES.ITEM_ADDED,
        payload: {
          listId: listId,
          itemId: itemId, // Use the actual item ID from YJS
          content: text,
          position: 0, // Position will be determined by YJS
          addedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(`Added item to list ${listId}: ${text}`);
    } catch (error) {
      this.logger.errorSync(`Failed to add item to list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Edit an item in a list
   */
  async editItem(listId: string, itemId: string, text: string): Promise<void> {
    try {
      // 1. Edit item in YJS document
      this.yjsListManager.editItem(listId, itemId, text);

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });

        // 3. Try real-time sync if online, otherwise queue
        if (this.connectionMonitor.isOnline()) {
          try {
            const clientId = await this.getClientId();
            await this.remoteStorageService.pushUpdate(listId, {
              id: generateUUID(),
              yjsDocumentId: listId,
              clientId: clientId,
              data: yjsState,
              timestamp: new Date(),
            });
            this.logger.infoSync(
              `Real-time sync successful for item edit in list ${listId}`
            );
            // Success, no need to queue - continue to emit event
          } catch (error) {
            this.logger.warnSync(
              `Real-time sync failed for item edit in list ${listId}, falling back to queue:`,
              error
            );
            // Fallback to queue
            await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
            // Trigger sync service to process the queued items
            await this.triggerBackgroundSync();
          }
        } else {
          // Offline - add to sync queue
          await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      }

      // 4. Emit event for UI updates
      this.eventService.publish({
        type: EVENT_TYPES.ITEM_CONTENT_CHANGED,
        payload: {
          listId: listId,
          itemId: itemId,
          content: text,
          changedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
        itemId: itemId,
      });

      this.logger.infoSync(`Edited item ${itemId} in list ${listId}: ${text}`);
    } catch (error) {
      this.logger.errorSync(
        `Failed to edit item ${itemId} in list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Delete an item from a list
   */
  async deleteItem(listId: string, itemId: string): Promise<void> {
    try {
      // 1. Delete item from YJS document
      this.yjsListManager.deleteItem(listId, itemId);

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });

        // 3. Try real-time sync if online, otherwise queue
        if (this.connectionMonitor.isOnline()) {
          try {
            const clientId = await this.getClientId();
            await this.remoteStorageService.pushUpdate(listId, {
              id: generateUUID(),
              yjsDocumentId: listId,
              clientId: clientId,
              data: yjsState,
              timestamp: new Date(),
            });
            this.logger.infoSync(
              `Real-time sync successful for item delete in list ${listId}`
            );
            // Success, no need to queue - continue to emit event
          } catch (error) {
            this.logger.warnSync(
              `Real-time sync failed for item delete in list ${listId}, falling back to queue:`,
              error
            );
            // Fallback to queue
            await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
            // Trigger sync service to process the queued items
            await this.triggerBackgroundSync();
          }
        } else {
          // Offline - add to sync queue
          await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      }

      // 4. Emit events for UI updates

      // Event for item deletion
      this.eventService.publish({
        type: EVENT_TYPES.ITEM_DELETED,
        payload: {
          listId: listId,
          itemId: itemId,
          content: '', // We don't have the content at this point
          deletedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
        itemId: itemId,
      });

      this.logger.infoSync(`Deleted item ${itemId} from list ${listId}`);
    } catch (error) {
      this.logger.errorSync(
        `Failed to delete item ${itemId} from list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Toggle an item's completion status
   */
  async toggleItem(listId: string, itemId: string): Promise<void> {
    try {
      // 1. Toggle item in YJS document
      this.yjsListManager.toggleItem(listId, itemId);

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });

        // 3. Try real-time sync if online, otherwise queue
        if (this.connectionMonitor.isOnline()) {
          try {
            const clientId = await this.getClientId();
            await this.remoteStorageService.pushUpdate(listId, {
              id: generateUUID(),
              yjsDocumentId: listId,
              clientId: clientId,
              data: yjsState,
              timestamp: new Date(),
            });
            this.logger.infoSync(
              `Real-time sync successful for item toggle in list ${listId}`
            );
            // Success, no need to queue - continue to emit event
          } catch (error) {
            this.logger.warnSync(
              `Real-time sync failed for item toggle in list ${listId}, falling back to queue:`,
              error
            );
            // Fallback to queue
            await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
            // Trigger sync service to process the queued items
            await this.triggerBackgroundSync();
          }
        } else {
          // Offline - add to sync queue
          await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      }

      // 4. Emit events for UI updates

      // Event for item toggle (we'll use completed/uncompleted based on current state)
      // For now, we'll publish a generic item content changed event
      this.eventService.publish({
        type: EVENT_TYPES.ITEM_CONTENT_CHANGED,
        payload: {
          listId: listId,
          itemId: itemId,
          oldContent: '', // We don't have the old content
          newContent: '', // We don't have the new content
          changedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
        itemId: itemId,
      });

      this.logger.infoSync(`Toggled item ${itemId} in list ${listId}`);
    } catch (error) {
      this.logger.errorSync(
        `Failed to toggle item ${itemId} in list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Move an item to a new position in the list
   */
  async moveItem(
    listId: string,
    itemId: string,
    newIndex: number
  ): Promise<void> {
    try {
      // 1. Move item in YJS document
      this.yjsListManager.moveItem(listId, itemId, newIndex);

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });

        // 3. Try real-time sync if online, otherwise queue
        if (this.connectionMonitor.isOnline()) {
          try {
            const clientId = await this.getClientId();
            await this.remoteStorageService.pushUpdate(listId, {
              id: generateUUID(),
              yjsDocumentId: listId,
              clientId: clientId,
              data: yjsState,
              timestamp: new Date(),
            });
            this.logger.infoSync(
              `Real-time sync successful for item move in list ${listId}`
            );
            // Success, no need to queue - continue to emit event
          } catch (error) {
            this.logger.warnSync(
              `Real-time sync failed for item move in list ${listId}, falling back to queue:`,
              error
            );
            // Fallback to queue
            await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
            // Trigger sync service to process the queued items
            await this.triggerBackgroundSync();
          }
        } else {
          // Offline - add to sync queue
          await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      }

      // 4. Emit event for UI updates
      this.eventService.publish({
        type: EVENT_TYPES.ITEM_MOVED,
        payload: {
          listId: listId,
          itemId: itemId,
          newIndex: newIndex,
          movedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
        itemId: itemId,
      });

      this.logger.infoSync(
        `Moved item ${itemId} to position ${newIndex} in list ${listId}`
      );
    } catch (error) {
      this.logger.errorSync(
        `Failed to move item ${itemId} in list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all lists
   */
  async getAllLists(): Promise<CollaborativeDocument[]> {
    try {
      // 1. Get all lists from repository
      const storedLists = await this.listRepository.getAllLists();

      // 2. Load YJS documents for each list
      const lists: CollaborativeDocument[] = [];

      for (const storedList of storedLists) {
        // Load YJS document if not already loaded
        if (!this.yjsListManager.isListLoaded(storedList.uuid)) {
          this.yjsListManager.applyYjsUpdate(storedList.uuid, storedList.data);
        }

        const list = this.yjsListManager.getList(storedList.uuid);
        if (list) {
          lists.push(list);
        }
      }

      // 3. Get ownership information from remote storage
      try {
        const userLists = await this.remoteStorageService.getUserLists();

        // Add ownership information to each list
        lists.forEach(list => {
          const listWithOwner = userLists.find(
            userList => userList.yjsDocumentId === list.id
          );
          if (listWithOwner) {
            list.ownerId = listWithOwner.ownerId;
          }
        });
      } catch (error) {
        // If we can't get ownership info, continue without it
        this.logger.warnSync('Failed to get ownership info for lists:', error);
      }

      return lists;
    } catch (error) {
      this.logger.errorSync(`Failed to get all lists:`, error);
      throw error;
    }
  }

  /**
   * Bootstrap local state from remote server
   */
  async bootstrapFromRemote(): Promise<void> {
    // Prevent multiple concurrent bootstrap calls
    if (this.isBootstrapping) {
      this.logger.debugSync(
        'Bootstrap already in progress, skipping duplicate call'
      );
      return;
    }

    this.isBootstrapping = true;
    try {
      this.logger.infoSync('Starting bootstrap from remote server...');

      // Check if browser is online (we'll attempt bootstrap even if realtime isn't connected yet)
      const connectionState = this.connectionMonitor.getConnectionState();
      this.logger.infoSync('Connection state during bootstrap:', {
        browserOnline: connectionState.browserOnline,
        realtimeConnected: connectionState.realtimeConnected,
        isOnline: connectionState.isOnline,
      });

      if (!connectionState.browserOnline) {
        this.logger.warnSync(
          'Cannot bootstrap from remote: browser is offline'
        );
        return;
      }

      if (!connectionState.realtimeConnected) {
        this.logger.warnSync(
          'Realtime service not connected, but attempting bootstrap anyway...'
        );
      }

      // Fetch all lists from remote storage
      const remoteLists = await this.remoteStorageService.getUserLists();
      this.logger.infoSync(
        `Found ${remoteLists.length} lists on remote server`
      );

      // Process each remote list
      for (const remoteList of remoteLists) {
        try {
          // Check if we already have this list locally
          const existingList = await this.listRepository.getList(
            remoteList.yjsDocumentId
          );

          if (!existingList) {
            // New list from remote - create it locally
            this.logger.infoSync(
              `Creating new list from remote: ${remoteList.yjsDocumentId}`
            );

            // Don't create YJS document here - let the first update create it
            // This ensures the title is set correctly from the YJS updates

            // Pull updates from remote and apply them (incremental sync)
            try {
              const clientId = await this.getClientId();
              const lastSyncTimestamp = await this.getLastSyncTimestamp(
                remoteList.yjsDocumentId
              );

              this.logger.infoSync(
                `Pulling updates for new list ${
                  remoteList.yjsDocumentId
                }${lastSyncTimestamp ? ` since ${lastSyncTimestamp.toISOString()}` : ' (all updates)'}`
              );

              const updates = await this.remoteStorageService.pullUpdates(
                remoteList.yjsDocumentId,
                lastSyncTimestamp || undefined, // since parameter - incremental sync
                clientId // exclude our own updates
              );

              if (updates.length > 0) {
                this.logger.infoSync(
                  `Applying ${updates.length} updates for list ${remoteList.yjsDocumentId}`
                );

                // Apply each update in chronological order
                for (const update of updates) {
                  this.yjsListManager.applyYjsUpdate(
                    remoteList.yjsDocumentId,
                    update.data
                  );
                }

                this.logger.infoSync(
                  `Applied ${updates.length} updates for list ${remoteList.yjsDocumentId}`
                );

                // Update last sync timestamp after successful sync
                const latestUpdateTimestamp =
                  updates[updates.length - 1]?.timestamp;
                if (latestUpdateTimestamp) {
                  await this.setLastSyncTimestamp(
                    remoteList.yjsDocumentId,
                    latestUpdateTimestamp
                  );
                }
              } else {
                this.logger.infoSync(
                  `No updates found for list ${remoteList.yjsDocumentId}`
                );

                // If no updates exist, create the document with the title from metadata
                // This handles the case where a list was created but no initial YJS state was pushed
                this.yjsListManager.createList(
                  remoteList.yjsDocumentId,
                  remoteList.title || 'Untitled List',
                  undefined,
                  remoteList.ownerId
                );
              }
            } catch (updateError) {
              this.logger.warnSync(
                `Failed to pull updates for list ${remoteList.yjsDocumentId}:`,
                updateError
              );
              // Continue with empty list
            }

            // Save to local storage
            const yjsState = this.yjsListManager.getYjsState(
              remoteList.yjsDocumentId
            );
            if (yjsState) {
              await this.listRepository.saveList({
                uuid: remoteList.yjsDocumentId,
                data: yjsState,
              });
            }

            // Emit events for UI update
            this.logger.infoSync(
              `Emitting list_created events for remote list: ${remoteList.yjsDocumentId}`
            );

            // Emit event for list creation
            this.eventService.publish({
              type: EVENT_TYPES.LIST_CREATED,
              payload: {
                listId: remoteList.yjsDocumentId,
                title: remoteList.title || 'Untitled List',
                createdAt: new Date(),
              },
              timestamp: new Date(),
              listId: remoteList.yjsDocumentId,
            });
          } else {
            // Existing list - check if remote is newer
            this.logger.debugSync(
              `Checking for updates to existing list: ${remoteList.yjsDocumentId}`
            );

            // Pull updates from remote and apply them (incremental sync)
            try {
              const clientId = await this.getClientId();
              const lastSyncTimestamp = await this.getLastSyncTimestamp(
                remoteList.yjsDocumentId
              );

              this.logger.infoSync(
                `Pulling updates for existing list ${
                  remoteList.yjsDocumentId
                }${lastSyncTimestamp ? ` since ${lastSyncTimestamp.toISOString()}` : ' (all updates)'}`
              );

              const updates = await this.remoteStorageService.pullUpdates(
                remoteList.yjsDocumentId,
                lastSyncTimestamp || undefined, // since parameter - incremental sync
                clientId // exclude our own updates
              );

              if (updates.length > 0) {
                this.logger.infoSync(
                  `Applying ${updates.length} updates for existing list ${remoteList.yjsDocumentId}`
                );

                // Apply each update in chronological order
                for (const update of updates) {
                  this.yjsListManager.applyYjsUpdate(
                    remoteList.yjsDocumentId,
                    update.data
                  );
                }

                // Save updated state
                const yjsState = this.yjsListManager.getYjsState(
                  remoteList.yjsDocumentId
                );
                if (yjsState) {
                  await this.listRepository.saveList({
                    uuid: remoteList.yjsDocumentId,
                    data: yjsState,
                  });
                }

                // Emit event for UI update
                this.eventService.publish({
                  type: EVENT_TYPES.LIST_METADATA_CHANGED,
                  payload: {
                    listId: remoteList.yjsDocumentId,
                    metadata: {
                      lastRemoteUpdate: new Date(),
                      source: 'remote',
                      action: 'content_changed',
                    },
                    changedAt: new Date(),
                  },
                  timestamp: new Date(),
                  listId: remoteList.yjsDocumentId,
                });

                this.logger.infoSync(
                  `Updated list ${remoteList.yjsDocumentId} with ${updates.length} remote updates`
                );

                // Update last sync timestamp after successful sync
                const latestUpdateTimestamp =
                  updates[updates.length - 1]?.timestamp;
                if (latestUpdateTimestamp) {
                  await this.setLastSyncTimestamp(
                    remoteList.yjsDocumentId,
                    latestUpdateTimestamp
                  );
                }
              } else {
                this.logger.debugSync(
                  `No updates found for existing list ${remoteList.yjsDocumentId}`
                );
              }
            } catch (updateError) {
              this.logger.warnSync(
                `Failed to pull updates for existing list ${remoteList.yjsDocumentId}:`,
                updateError
              );
            }
          }
        } catch (error) {
          this.logger.errorSync(
            `Failed to process remote list ${remoteList.yjsDocumentId}:`,
            error
          );
        }
      }

      this.logger.infoSync('Bootstrap from remote server completed');

      // Emit a global event to notify UI components that bootstrap is complete
      // This ensures UI components refresh their data after bootstrap changes
      this.eventService.publish({
        type: EVENT_TYPES.BOOTSTRAP_COMPLETED,
        payload: {
          listId: 'all', // Special ID to indicate all lists
          metadata: {
            action: EVENT_TYPES.BOOTSTRAP_COMPLETED,
            completedAt: new Date(),
          },
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.errorSync('Failed to bootstrap from remote server:', error);
      throw error;
    } finally {
      this.isBootstrapping = false;
    }
  }

  /**
   * Get a specific list
   */
  async getList(listId: string): Promise<CollaborativeDocument | null> {
    try {
      // 1. Check if YJS document is loaded
      if (!this.yjsListManager.isListLoaded(listId)) {
        // 2. Load from repository
        const storedList = await this.listRepository.getList(listId);
        if (storedList) {
          this.yjsListManager.applyYjsUpdate(listId, storedList.data);
        } else {
          return null;
        }
      }

      // 3. Get the collaborative document
      const document = this.yjsListManager.getList(listId);
      if (!document) {
        return null;
      }

      // 4. Get ownership information from remote storage
      try {
        const userLists = await this.remoteStorageService.getUserLists();
        const listWithOwner = userLists.find(
          list => list.yjsDocumentId === listId
        );
        if (listWithOwner) {
          document.ownerId = listWithOwner.ownerId;
        }
      } catch (error) {
        // If we can't get ownership info, continue without it
        this.logger.warnSync(
          `Failed to get ownership info for list ${listId}:`,
          error
        );
      }

      return document;
    } catch (error) {
      this.logger.errorSync(`Failed to get list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Apply remote update to a list
   */
  async applyRemoteUpdate(
    listId: string,
    update: Uint8Array,
    updateTimestamp?: Date
  ): Promise<void> {
    try {
      // 1. Apply update to YJS document
      this.yjsListManager.applyYjsUpdate(listId, update);

      // 2. Save updated state to repository (don't add to sync queue)
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });
      }

      // 3. Emit events for UI updates

      // Event for remote update - this will trigger list reload
      // We use a generic "list changed" approach since we don't know the specific changes
      this.eventService.publish({
        type: EVENT_TYPES.LIST_METADATA_CHANGED,
        payload: {
          listId: listId,
          metadata: {
            lastRemoteUpdate: new Date(),
            source: 'remote',
            action: 'content_changed',
          },
          changedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      // 4. Update last sync timestamp if provided
      if (updateTimestamp) {
        await this.setLastSyncTimestamp(listId, updateTimestamp);
      }

      this.logger.infoSync(`Applied remote update to list ${listId}`);
    } catch (error) {
      this.logger.errorSync(
        `Failed to apply remote update to list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle remote list creation
   */
  async handleRemoteListCreation(listId: string): Promise<void> {
    try {
      this.logger.infoSync(`Handling remote list creation: ${listId}`);

      // Check if we already have this list locally
      const existingList = await this.listRepository.getList(listId);
      if (existingList) {
        this.logger.debugSync(
          `List ${listId} already exists locally, skipping creation`
        );
        return;
      }

      // Get the list metadata from remote
      const remoteLists = await this.remoteStorageService.getUserLists();
      const remoteList = remoteLists.find(
        list => list.yjsDocumentId === listId
      );

      if (!remoteList) {
        this.logger.warnSync(`Remote list ${listId} not found in user lists`);
        return;
      }

      this.logger.infoSync(`Creating new list from remote: ${listId}`);

      // Pull updates from remote and apply them
      try {
        const clientId = await this.getClientId();
        const lastSyncTimestamp = await this.getLastSyncTimestamp(listId);

        this.logger.infoSync(
          `Pulling updates for new remote list ${listId}${lastSyncTimestamp ? ` since ${lastSyncTimestamp.toISOString()}` : ' (all updates)'}`
        );

        const updates = await this.remoteStorageService.pullUpdates(
          listId,
          lastSyncTimestamp || undefined,
          clientId
        );

        if (updates.length > 0) {
          this.logger.infoSync(
            `Applying ${updates.length} updates for list ${listId}`
          );

          // Apply each update in chronological order
          for (const update of updates) {
            this.yjsListManager.applyYjsUpdate(listId, update.data);
          }

          this.logger.infoSync(
            `Applied ${updates.length} updates for list ${listId}`
          );

          // Update last sync timestamp after successful sync
          const latestUpdateTimestamp = updates[updates.length - 1]?.timestamp;
          if (latestUpdateTimestamp) {
            await this.setLastSyncTimestamp(listId, latestUpdateTimestamp);
          }
        } else {
          this.logger.infoSync(`No updates found for list ${listId}`);

          // If no updates exist, create the document with the title from metadata
          this.yjsListManager.createList(
            listId,
            remoteList.title || 'Untitled List',
            undefined,
            remoteList.ownerId
          );
        }
      } catch (updateError) {
        this.logger.warnSync(
          `Failed to pull updates for list ${listId}:`,
          updateError
        );
        // Continue with empty list
      }

      // Save to local storage
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });
      }

      // Emit events for UI update
      this.logger.infoSync(
        `Emitting list_created events for remote list: ${listId}`
      );

      // Emit event for list creation
      this.eventService.publish({
        type: EVENT_TYPES.LIST_CREATED,
        payload: {
          listId: listId,
          title: remoteList.title || 'Untitled List',
          createdAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(
        `Successfully handled remote list creation: ${listId}`
      );
    } catch (error) {
      this.logger.errorSync(
        `Failed to handle remote list creation ${listId}:`,
        error
      );
    }
  }

  /**
   * Handle remote list deletion
   */
  async handleRemoteListDeletion(listId: string): Promise<void> {
    try {
      this.logger.infoSync(`Handling remote deletion of list: ${listId}`);

      // 1. Remove from YJS manager
      this.yjsListManager.deleteList(listId);

      // 2. Remove from local repository
      await this.listRepository.deleteList(listId);

      // 3. Clear sync queue items for this list
      await this.syncQueueRepository.clearSyncQueueItemsForList(listId);

      // 4. Clear sync metadata for this list
      await this.clearSyncMetadataForDocument(listId);

      // 5. Emit events for UI updates

      // Event for remote list deletion
      this.eventService.publish({
        type: EVENT_TYPES.LIST_DELETED,
        payload: {
          listId: listId,
          title: '', // We don't have the title at this point, but it's not critical
          deletedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(
        `Successfully handled remote deletion of list: ${listId}`
      );
    } catch (error) {
      this.logger.errorSync(
        `Failed to handle remote deletion of list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get sync queue items for processing
   */
  async getSyncQueueItems(): Promise<SyncQueue[]> {
    try {
      return await this.syncQueueRepository.getAllSyncQueueItems();
    } catch (error) {
      this.logger.errorSync(`Failed to get sync queue items:`, error);
      throw error;
    }
  }

  /**
   * Remove processed sync queue item
   */
  async removeSyncQueueItem(uuid: string): Promise<void> {
    try {
      await this.syncQueueRepository.deleteSyncQueueItem(uuid);
      this.logger.infoSync(`Removed sync queue item: ${uuid}`);
    } catch (error) {
      this.logger.errorSync(`Failed to remove sync queue item ${uuid}:`, error);
      throw error;
    }
  }

  /**
   * Edit list metadata (title and/or description)
   */
  async editListMetadata(
    listId: string,
    updates: { title?: string; description?: string }
  ): Promise<void> {
    try {
      // 1. Update YJS document metadata
      if (updates.title !== undefined) {
        this.yjsListManager.editListTitle(listId, updates.title);
      }
      if (updates.description !== undefined) {
        this.yjsListManager.editListDescription(listId, updates.description);
      }

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });
      }

      // 3. Add to sync queue
      await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState!);
      // Trigger sync service to process the queued items
      await this.triggerBackgroundSync();

      // 4. Emit event for UI updates
      this.eventService.publish({
        type: EVENT_TYPES.LIST_METADATA_CHANGED,
        payload: {
          listId: listId,
          metadata: {
            ...updates,
            action: 'metadata_changed',
          },
          changedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      const changes = [];
      if (updates.title !== undefined) {
        changes.push(`title: ${updates.title}`);
      }
      if (updates.description !== undefined) {
        changes.push(`description: ${updates.description}`);
      }

      this.logger.infoSync(
        `Edited metadata of list ${listId}: ${changes.join(', ')}`
      );
    } catch (error) {
      this.logger.errorSync(
        `Failed to edit metadata of list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clear all completed items from a list
   */
  async clearCompletedItems(listId: string): Promise<void> {
    try {
      // 1. Clear completed items from YJS document
      this.yjsListManager.clearCompletedItems(listId);

      // 2. Save updated state to repository
      const yjsState = this.yjsListManager.getYjsState(listId);
      if (yjsState) {
        await this.listRepository.saveList({
          uuid: listId,
          data: yjsState,
        });
      }

      // 3. Add to sync queue
      await this.syncQueueRepository.addYjsUpdateItem(listId, yjsState!);
      // Trigger sync service to process the queued items
      await this.triggerBackgroundSync();

      // 4. Emit event for UI updates
      this.eventService.publish({
        type: EVENT_TYPES.LIST_METADATA_CHANGED,
        payload: {
          listId: listId,
          metadata: {
            action: 'completed_items_cleared',
          },
          changedAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(`Cleared completed items from list ${listId}`);
    } catch (error) {
      this.logger.errorSync(
        `Failed to clear completed items from list ${listId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Leave a list (remove user as participant)
   */
  async leaveList(listId: string): Promise<void> {
    try {
      // 1. Remove from YJS manager
      this.yjsListManager.deleteList(listId);

      // 2. Remove from repositories
      await this.listRepository.deleteList(listId);

      // 3. Clear any existing sync queue items for this list
      await this.syncQueueRepository.clearSyncQueueItemsForList(listId);

      // 4. Clear sync metadata for this list
      await this.clearSyncMetadataForDocument(listId);

      // 5. Try real-time sync if online, otherwise queue
      if (this.connectionMonitor.isOnline()) {
        try {
          await this.remoteStorageService.removeParticipant(listId);
          this.logger.infoSync(
            `Real-time sync successful for leaving list ${listId}`
          );
          // Success, no need to queue - continue to emit event
        } catch (error) {
          this.logger.warnSync(
            `Real-time sync failed for leaving list ${listId}, falling back to queue:`,
            error
          );
          // Fallback to queue
          await this.syncQueueRepository.addListLeaveItem(listId);
          // Trigger sync service to process the queued items
          await this.triggerBackgroundSync();
        }
      } else {
        // Offline - add to sync queue
        await this.syncQueueRepository.addListLeaveItem(listId);
        // Trigger sync service to process the queued items
        await this.triggerBackgroundSync();
      }

      // 6. Emit events for UI updates

      // Event for list leaving
      this.eventService.publish({
        type: EVENT_TYPES.LIST_LEFT,
        payload: {
          listId: listId,
          title: '', // We don't have the title at this point, but it's not critical
          leftAt: new Date(),
        },
        timestamp: new Date(),
        listId: listId,
      });

      this.logger.infoSync(`Left list: ${listId}`);
    } catch (error) {
      this.logger.errorSync(`Failed to leave list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all data (for sign out)
   */
  async clearAllData(): Promise<void> {
    try {
      // 1. Clear YJS documents
      this.yjsListManager.clearAllState();

      // 2. Clear repositories
      await this.listRepository.clearAllLists();
      await this.syncQueueRepository.clearAllSyncQueueItems();
      await this.metadataRepository.clearAllMetadata();

      this.logger.infoSync(`Cleared all data`);
    } catch (error) {
      this.logger.errorSync(`Failed to clear all data:`, error);
      throw error;
    }
  }

  // ===== SYNC METADATA METHODS =====

  /**
   * Get or generate client ID
   */
  async getClientId(): Promise<string> {
    // Return cached value if available
    if (this.cachedClientId) {
      return this.cachedClientId;
    }

    try {
      const metadata = await this.metadataRepository.getMetadata('client_id');

      if (metadata && metadata.value.clientId) {
        this.cachedClientId = metadata.value.clientId;
        return metadata.value.clientId;
      }

      // Generate new client ID if none exists
      const newClientId = generateUUID();
      await this.setClientId(newClientId);
      return newClientId;
    } catch (error) {
      this.logger.errorSync('Error getting client ID:', error);
      // Fallback to generating a new one
      const fallbackClientId = generateUUID();
      await this.setClientId(fallbackClientId);
      return fallbackClientId;
    }
  }

  /**
   * Set client ID
   */
  async setClientId(clientId: string): Promise<void> {
    this.cachedClientId = clientId;

    try {
      await this.metadataRepository.saveMetadata({
        key: 'client_id',
        value: {
          clientId,
          createdAt: new Date().toISOString(),
        },
      });

      this.logger.debugSync(`Set client ID:`, { clientId });
    } catch (error) {
      this.logger.errorSync('Error setting client ID:', error);
      throw error;
    }
  }

  /**
   * Save sync state for a list
   */
  async saveSyncState(syncState: SyncState): Promise<void> {
    const key = `sync_state_${syncState.yjsDocumentId}`;

    await this.metadataRepository.saveMetadata({
      key,
      value: {
        lastSyncTime: syncState.lastSyncTime?.toISOString(),
        isOnline: syncState.isOnline,
        pendingChangesCount: syncState.pendingChangesCount,
        lastUpdated: new Date().toISOString(),
      },
    });

    this.logger.debugSync(`Saved sync state:`, {
      yjsDocumentId: syncState.yjsDocumentId,
      lastSyncTime: syncState.lastSyncTime,
      isOnline: syncState.isOnline,
      pendingChangesCount: syncState.pendingChangesCount,
    });
  }

  /**
   * Get sync state for a list
   */
  async getSyncState(yjsDocumentId: string): Promise<SyncState | null> {
    const key = `sync_state_${yjsDocumentId}`;
    const metadata = await this.metadataRepository.getMetadata(key);

    if (!metadata) {
      return null;
    }

    return {
      yjsDocumentId,
      lastSyncTime: metadata.value.lastSyncTime
        ? new Date(metadata.value.lastSyncTime)
        : undefined,
      isOnline: metadata.value.isOnline || false,
      pendingChangesCount: metadata.value.pendingChangesCount || 0,
    };
  }

  /**
   * Get all sync states
   */
  async getAllSyncStates(): Promise<SyncState[]> {
    const allMetadata = await this.metadataRepository.getAllMetadata();
    const syncStates: SyncState[] = [];

    for (const metadata of allMetadata) {
      if (metadata.key.startsWith('sync_state_')) {
        const yjsDocumentId = metadata.key.replace('sync_state_', '');
        syncStates.push({
          yjsDocumentId,
          lastSyncTime: metadata.value.lastSyncTime
            ? new Date(metadata.value.lastSyncTime)
            : undefined,
          isOnline: metadata.value.isOnline || false,
          pendingChangesCount: metadata.value.pendingChangesCount || 0,
        });
      }
    }

    return syncStates;
  }

  /**
   * Save applied remote update ID
   */
  async saveAppliedRemoteUpdate(
    yjsDocumentId: string,
    updateId: string
  ): Promise<void> {
    const key = `applied_remote_updates_${yjsDocumentId}`;
    const existing = await this.metadataRepository.getMetadata(key);

    const appliedUpdates = existing ? existing.value.appliedUpdates || [] : [];
    appliedUpdates.push(updateId);

    await this.metadataRepository.saveMetadata({
      key,
      value: {
        appliedUpdates,
        lastUpdated: new Date().toISOString(),
      },
    });

    this.logger.debugSync(`Saved applied remote update:`, {
      yjsDocumentId,
      updateId,
    });
  }

  /**
   * Get applied remote update IDs for a list
   */
  async getAppliedRemoteUpdates(yjsDocumentId: string): Promise<string[]> {
    const key = `applied_remote_updates_${yjsDocumentId}`;
    const metadata = await this.metadataRepository.getMetadata(key);

    if (!metadata) {
      return [];
    }

    return metadata.value.appliedUpdates || [];
  }

  /**
   * Clear applied remote updates for a list
   */
  async clearAppliedRemoteUpdates(yjsDocumentId: string): Promise<void> {
    const key = `applied_remote_updates_${yjsDocumentId}`;
    await this.metadataRepository.deleteMetadata(key);

    this.logger.debugSync(`Cleared applied remote updates:`, {
      yjsDocumentId,
    });
  }

  /**
   * Clear sync metadata for a specific document
   */
  async clearSyncMetadataForDocument(yjsDocumentId: string): Promise<void> {
    try {
      // Clear sync state for this document
      await this.metadataRepository.deleteMetadata(
        `sync_state_${yjsDocumentId}`
      );

      // Clear applied remote updates for this document
      await this.metadataRepository.deleteMetadata(
        `applied_remote_updates_${yjsDocumentId}`
      );

      // Clear last sync timestamp for this document
      await this.metadataRepository.deleteMetadata(
        `last_sync_${yjsDocumentId}`
      );

      this.logger.debugSync(`Cleared sync metadata for document:`, {
        yjsDocumentId,
      });
    } catch (error) {
      this.logger.errorSync(
        'Error clearing sync metadata for document:',
        error
      );
      throw error;
    }
  }

  /**
   * Get last sync timestamp for a list
   */
  async getLastSyncTimestamp(yjsDocumentId: string): Promise<Date | null> {
    try {
      const key = `last_sync_${yjsDocumentId}`;
      const metadata = await this.metadataRepository.getMetadata(key);

      if (!metadata || !metadata.value.lastSyncTimestamp) {
        return null;
      }

      return new Date(metadata.value.lastSyncTimestamp);
    } catch (error) {
      this.logger.errorSync('Error getting last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Set last sync timestamp for a list
   */
  async setLastSyncTimestamp(
    yjsDocumentId: string,
    timestamp: Date
  ): Promise<void> {
    try {
      const key = `last_sync_${yjsDocumentId}`;
      await this.metadataRepository.saveMetadata({
        key,
        value: {
          lastSyncTimestamp: timestamp.toISOString(),
          lastUpdated: new Date().toISOString(),
        },
      });

      this.logger.debugSync(`Set last sync timestamp for ${yjsDocumentId}:`, {
        timestamp: timestamp.toISOString(),
      });
    } catch (error) {
      this.logger.errorSync('Error setting last sync timestamp:', error);
      throw error;
    }
  }

  /**
   * Trigger background sync service to process queued items
   */
  private async triggerBackgroundSync(): Promise<void> {
    try {
      // Get the background sync service from the service container
      // We need to import ServiceContainer to access it
      const { ServiceContainer } = await import('@/services/container');
      const serviceContainer = ServiceContainer.getInstance();
      const backgroundSyncService = serviceContainer.getBackgroundSyncService();

      // Trigger sync if the service is started
      if (backgroundSyncService.isServiceStarted()) {
        await backgroundSyncService.triggerSync();
      }
    } catch (error) {
      this.logger.errorSync('Error triggering background sync:', error);
      // Don't throw - this is not critical for the main operation
    }
  }
}
