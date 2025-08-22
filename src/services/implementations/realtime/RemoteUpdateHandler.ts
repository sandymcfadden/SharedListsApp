import { ILogService } from '@/services/interfaces/ILogService';
import { ListController } from '@/services/controllers/ListController';
import {
  IRealtimeService,
  CRDTRealtimeUpdate,
  RealtimeUpdate,
} from '@/services/interfaces/IRealtimeService';

export class RemoteUpdateHandler {
  private isSubscribed = false;

  constructor(
    private listController: ListController,
    private realtimeService: IRealtimeService,
    private logger: ILogService
  ) {}

  /**
   * Start listening for remote updates
   */
  async start(): Promise<void> {
    if (this.isSubscribed) {
      this.logger.infoSync('Remote update handler is already subscribed');
      return;
    }

    this.logger.infoSync('Starting remote update handler');

    try {
      // Subscribe to CRDT updates
      this.realtimeService.subscribeToCRDTUpdates(
        async (update: CRDTRealtimeUpdate) => {
          try {
            // Get our own client ID to filter out our own updates
            const ourClientId = await this.listController.getClientId();
            // Skip updates from our own client ID
            if (update.record.client_id === ourClientId) {
              this.logger.debugSync(
                `Ignoring update from our own client ID: ${ourClientId}`
              );
              return;
            }

            const listId = update.record.yjs_document_id;
            const updateData = new Uint8Array(update.record.update_data);
            const updateTimestamp = new Date(update.record.created_at);
            this.logger.infoSync(
              `Received remote update for list: ${listId} from client: ${update.record.client_id}`
            );
            await this.listController.applyRemoteUpdate(
              listId,
              updateData,
              updateTimestamp
            );
          } catch (error) {
            this.logger.errorSync(`Failed to apply remote update:`, error);
          }
        }
      );

      // Subscribe to list updates (for creations and deletions)
      this.realtimeService.subscribeToListUpdates(
        async (update: RealtimeUpdate) => {
          console.log('>>>>>>>>>RealtimeUpdate', update);
          try {
            if (update.eventType === 'INSERT' && update.record) {
              // Handle new list creation
              const listId = update.record.yjs_document_id;
              this.logger.infoSync(
                `Received remote list creation for: ${listId}`
              );
              await this.listController.handleRemoteListCreation(listId);
            } else if (update.eventType === 'UPDATE' && update.record) {
              const listId = update.record.yjs_document_id;

              // Check if this is a deletion (deleted_by or deleted_at is set)
              if (update.record.deleted_by || update.record.deleted_at) {
                this.logger.infoSync(
                  `Received remote list deletion for: ${listId} (deleted_by: ${update.record.deleted_by}, deleted_at: ${update.record.deleted_at})`
                );
                await this.listController.handleRemoteListDeletion(listId);
              } else {
                this.logger.debugSync(
                  `Received list update (not deletion) for: ${listId}`
                );
                // For now, we don't handle other list updates
                // This could be expanded to handle title changes, ownership changes, etc.
              }
            }
          } catch (error) {
            this.logger.errorSync(`Failed to handle list update:`, error);
          }
        }
      );

      this.isSubscribed = true;
      this.logger.infoSync('Remote update handler started successfully');
    } catch (error) {
      this.logger.errorSync('Failed to start remote update handler:', error);
      throw error;
    }
  }

  /**
   * Stop listening for remote updates
   */
  stop(): void {
    if (!this.isSubscribed) {
      this.logger.infoSync('Remote update handler is not subscribed');
      return;
    }

    this.logger.infoSync('Stopping remote update handler');
    // TODO: Store subscription reference and unsubscribe properly
    this.isSubscribed = false;
  }

  /**
   * Check if the handler is subscribed
   */
  isHandlerSubscribed(): boolean {
    return this.isSubscribed;
  }
}
