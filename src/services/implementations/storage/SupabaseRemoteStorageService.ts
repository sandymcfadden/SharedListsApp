import { SupabaseClient } from '@supabase/supabase-js';
import {
  IRemoteStorageService,
  AllUserLists,
} from '@/services/interfaces/IRemoteStorageService';
import { ILogService } from '@/services/interfaces/ILogService';
import {
  List,
  UserProfile,
  ListInvite,
  CreateInviteRequest,
  CreateInviteResponse,
} from '@/types/List';
import { SupabaseClientSingleton } from '@/services/implementations/auth/SupabaseClient';
import { generateUUID } from '@/utils/uuid';

export interface YjsUpdate {
  id: string;
  yjsDocumentId: string;
  clientId?: string; // Optional client identifier to filter out own updates
  data: Uint8Array;
  timestamp: Date;
}

export interface YjsSnapshot {
  id: string;
  yjsDocumentId: string;
  data: Uint8Array;
  version: number;
  timestamp: Date;
}

interface ParticipantListRow {
  list_id: string;
  lists: {
    id: string;
    yjs_document_id: string;
    owner_id: string;
    created_at: string;
    updated_at: string;
    deleted_by?: string;
    deleted_at?: string;
  };
}

export class SupabaseRemoteStorageService implements IRemoteStorageService {
  private supabase: SupabaseClient;
  private userId: string | null = null;
  private logger: ILogService;

  constructor(supabaseUrl: string, supabaseKey: string, logger: ILogService) {
    this.supabase = SupabaseClientSingleton.getInstance(
      supabaseUrl,
      supabaseKey
    );
    this.logger = logger;
  }

  async setUserId(userId: string): Promise<void> {
    // Only log and set if the user ID is actually changing
    if (this.userId !== userId) {
      this.logger.infoSync(
        `Setting user ID in remote storage service: ${userId}`
      );
      this.userId = userId;
    } else {
      this.logger.debugSync(
        `User ID already set to: ${userId}, skipping redundant setUserId call`
      );
    }
  }

  getUserId(): string | null {
    return this.userId;
  }

  // List discovery and permissions
  async listExists(yjsDocumentId: string): Promise<boolean> {
    if (!this.userId) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('lists')
      .select('id')
      .eq('yjs_document_id', yjsDocumentId)
      .is('deleted_by', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return false;
      }
      throw new Error(`Failed to check if list exists: ${error.message}`);
    }

    return !!data;
  }

  async createList(yjsDocumentId: string): Promise<List> {
    if (!this.userId) throw new Error('User not authenticated');

    this.logger.infoSync(`Creating list in Supabase:`, {
      yjsDocumentId,
      userId: this.userId,
    });

    const { data, error } = await this.supabase
      .from('lists')
      .insert({
        yjs_document_id: yjsDocumentId,
        owner_id: this.userId,
      })
      .select()
      .single();

    if (error) {
      this.logger.errorSync(`Failed to create list:`, error);
      throw new Error(`Failed to create list: ${error.message}`);
    }

    this.logger.infoSync(`List created successfully:`, data);

    // Manually add owner as participant
    const { error: participantError } = await this.supabase
      .from('list_participants')
      .insert({
        list_id: data.id,
        user_id: this.userId,
        role: 'owner',
      });

    if (participantError) {
      this.logger.warnSync(
        'Failed to add owner as participant:',
        participantError.message
      );
      // Don't fail the list creation if participant addition fails
    } else {
      this.logger.infoSync(`Owner added as participant for list: ${data.id}`);
    }

    return {
      id: data.id,
      yjsDocumentId: data.yjs_document_id,
      ownerId: data.owner_id,
      isShared: false, // Will be determined by checking list_participants
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  async getUserLists(): Promise<List[]> {
    if (!this.userId) throw new Error('User not authenticated');

    try {
      // Get lists where user is the owner
      const { data: ownedLists, error: ownedError } = await this.supabase
        .from('lists')
        .select('id, yjs_document_id, owner_id, created_at, updated_at')
        .eq('owner_id', this.userId)
        .is('deleted_by', null);

      if (ownedError) {
        throw new Error(`Failed to get owned lists: ${ownedError.message}`);
      }

      // Get lists where user is a participant (but not owner)
      const { data: participantLists, error: participantError } =
        await this.supabase
          .from('list_participants')
          .select(
            `
          list_id,
          lists!inner(id, yjs_document_id, owner_id, created_at, updated_at)
        `
          )
          .eq('user_id', this.userId)
          .neq('lists.owner_id', this.userId) // Exclude lists where user is owner
          .is('lists.deleted_by', null);

      if (participantError) {
        throw new Error(
          `Failed to get participant lists: ${participantError.message}`
        );
      }

      // Combine and format the results
      const allLists: List[] = [];

      // Add owned lists
      if (ownedLists) {
        for (const row of ownedLists) {
          allLists.push({
            id: row.id,
            yjsDocumentId: row.yjs_document_id,
            ownerId: row.owner_id,
            isShared: false, // User is the owner
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          });
        }
      }

      // Add participant lists
      if (participantLists) {
        for (const row of participantLists as unknown as ParticipantListRow[]) {
          const list = row.lists;
          allLists.push({
            id: list.id,
            yjsDocumentId: list.yjs_document_id,
            ownerId: list.owner_id,
            isShared: true, // User is a participant, not owner
            createdAt: new Date(list.created_at),
            updatedAt: new Date(list.updated_at),
          });
        }
      }

      return allLists;
    } catch (error) {
      this.logger.errorSync('Error in getUserLists:', error);
      throw error;
    }
  }

  async getAllUserLists(since?: Date): Promise<AllUserLists> {
    if (!this.userId) throw new Error('User not authenticated');

    try {
      // Get owned lists (active and deleted)
      let ownedQuery = this.supabase
        .from('lists')
        .select(
          `
          id,
          yjs_document_id,
          owner_id,
          created_at,
          updated_at,
          deleted_by,
          deleted_at
        `
        )
        .eq('owner_id', this.userId);

      // If 'since' is provided, we need to get:
      // 1. All active lists (deleted_by IS NULL) - no time filter
      // 2. Only deleted lists (deleted_by IS NOT NULL) that were deleted since 'since'
      if (since) {
        ownedQuery = ownedQuery.or(
          `deleted_by.is.null,deleted_at.gte.${since.toISOString()}`
        );
      }

      const { data: ownedData, error: ownedError } = await ownedQuery;

      if (ownedError) {
        throw new Error(`Failed to get owned lists: ${ownedError.message}`);
      }

      // Get participant lists (only active ones, since participants can't see deleted lists)
      const { data: participantData, error: participantError } =
        await this.supabase
          .from('list_participants')
          .select(
            `
          list_id,
          lists!inner(id, yjs_document_id, owner_id, created_at, updated_at, deleted_by, deleted_at)
        `
          )
          .eq('user_id', this.userId)
          .neq('lists.owner_id', this.userId) // Exclude lists where user is owner
          .is('lists.deleted_by', null); // Only active lists

      if (participantError) {
        throw new Error(
          `Failed to get participant lists: ${participantError.message}`
        );
      }

      // Split the results
      const activeLists: List[] = [];
      const deletedLists: string[] = [];

      // Process owned lists
      if (ownedData) {
        for (const row of ownedData) {
          if (row.deleted_by === null) {
            // Active list
            activeLists.push({
              id: row.id,
              yjsDocumentId: row.yjs_document_id,
              ownerId: row.owner_id,
              isShared: false, // User is the owner
              createdAt: new Date(row.created_at),
              updatedAt: new Date(row.updated_at),
            });
          } else {
            // Deleted list - only include if it meets the 'since' criteria
            if (!since || new Date(row.deleted_at) >= since) {
              deletedLists.push(row.yjs_document_id);
            }
          }
        }
      }

      // Process participant lists (all active)
      if (participantData) {
        for (const row of participantData as unknown as ParticipantListRow[]) {
          const list = row.lists;
          activeLists.push({
            id: list.id,
            yjsDocumentId: list.yjs_document_id,
            ownerId: list.owner_id,
            isShared: true, // User is a participant, not owner
            createdAt: new Date(list.created_at),
            updatedAt: new Date(list.updated_at),
          });
        }
      }

      return { activeLists, deletedLists };
    } catch (error) {
      this.logger.errorSync('Error in getAllUserLists:', error);
      throw error;
    }
  }

  async deleteList(yjsDocumentId: string): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    // Soft delete the list by updating deleted_by and deleted_at
    // The RLS policy will handle permission checking (owner or participant)
    // A database trigger will automatically clean up CRDT data
    const { error: deleteError } = await this.supabase
      .from('lists')
      .update({
        deleted_by: this.userId,
        deleted_at: new Date().toISOString(),
      })
      .eq('yjs_document_id', yjsDocumentId)
      .is('deleted_by', null); // Only update if not already deleted

    if (deleteError) {
      throw new Error(`Failed to delete list: ${deleteError.message}`);
    }

    this.logger.infoSync(
      `Successfully soft deleted list for yjs_document_id: ${yjsDocumentId}`
    );
  }

  // CRDT sync operations
  async pushUpdate(yjsDocumentId: string, update: YjsUpdate): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    // Convert Uint8Array to number array (y-supabase approach)
    const updateArray = Array.from(update.data);

    const { error } = await this.supabase.from('crdt_updates').insert({
      yjs_document_id: yjsDocumentId,
      user_id: this.userId,
      client_id: update.clientId, // Store client ID
      update_data: updateArray, // Send as number array instead of Uint8Array
    });

    if (error) throw new Error(`Failed to push update: ${error.message}`);
  }

  async pullUpdates(
    yjsDocumentId: string,
    since?: Date,
    excludeClientId?: string
  ): Promise<YjsUpdate[]> {
    if (!this.userId) throw new Error('User not authenticated');

    let query = this.supabase
      .from('crdt_updates')
      .select('*')
      .eq('yjs_document_id', yjsDocumentId)
      .order('created_at', { ascending: true });

    if (since) {
      query = query.gt('created_at', since.toISOString());
    }

    // Filter out updates from the current client if specified
    if (excludeClientId) {
      query = query.neq('client_id', excludeClientId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to pull updates: ${error.message}`);

    this.logger.infoSync(
      `Pulled ${data.length} remote updates since ${since?.toISOString() || 'beginning'}${excludeClientId ? ` (excluding client ${excludeClientId})` : ''}`
    );

    return data.map(row => {
      // Convert update_data back to Uint8Array if it's a string
      let updateData: Uint8Array;
      try {
        if (typeof row.update_data === 'string') {
          // Convert string back to Uint8Array
          const bytes = new Uint8Array(row.update_data.length);
          for (let i = 0; i < row.update_data.length; i++) {
            bytes[i] = row.update_data.charCodeAt(i);
          }
          updateData = bytes;
        } else if (Array.isArray(row.update_data)) {
          // Handle number array (y-supabase approach)
          updateData = new Uint8Array(row.update_data);
        } else if (row.update_data instanceof Uint8Array) {
          updateData = row.update_data;
        } else {
          this.logger.warnSync(
            'Unknown update_data type:',
            typeof row.update_data
          );
          updateData = new Uint8Array(0);
        }
      } catch (error) {
        this.logger.errorSync('Failed to convert update_data:', error);
        updateData = new Uint8Array(0);
      }

      return {
        id: row.id,
        yjsDocumentId: row.yjs_document_id,
        userId: row.user_id,
        clientId: row.client_id, // Include client ID
        data: updateData,
        timestamp: new Date(row.created_at),
      };
    });
  }

  async pushSnapshot(
    yjsDocumentId: string,
    snapshot: YjsSnapshot
  ): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    const { error } = await this.supabase.from('crdt_snapshots').insert({
      yjs_document_id: yjsDocumentId,
      snapshot_data: snapshot.data,
      version: snapshot.version,
    });

    if (error) throw new Error(`Failed to push snapshot: ${error.message}`);
  }

  async pullLatestSnapshot(yjsDocumentId: string): Promise<YjsSnapshot | null> {
    const { data, error } = await this.supabase
      .from('crdt_snapshots')
      .select('*')
      .eq('yjs_document_id', yjsDocumentId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new Error(`Failed to pull snapshot: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      yjsDocumentId: data.yjs_document_id,
      data: data.snapshot_data,
      version: data.version,
      timestamp: new Date(data.created_at),
    };
  }

  // Sharing operations (placeholder implementations)
  async shareList(_listId: string, _email: string): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    // TODO: Implement list sharing
    throw new Error('List sharing not yet implemented');
  }

  async acceptInvite(token: string): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    this.logger.infoSync('Accepting invite with token:', token);

    // First, get the invite to verify it exists and is valid
    const { data: inviteData, error: inviteError } = await this.supabase
      .from('list_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError) {
      if (inviteError.code === 'PGRST116') {
        throw new Error('Invite not found or already used');
      }
      throw new Error(`Failed to get invite: ${inviteError.message}`);
    }

    // Check if the invite has expired
    if (new Date(inviteData.expires_at) < new Date()) {
      throw new Error('Invite has expired');
    }

    // Note: We don't check if user is already a participant here because:
    // 1. RLS policies prevent non-participants from querying list_participants
    // 2. The database trigger will handle duplicate prevention with ON CONFLICT DO NOTHING

    // Use the database function to accept the invite (bypasses RLS)
    const { data: success, error: acceptError } = await this.supabase.rpc(
      'accept_invite',
      {
        invite_token: token,
        user_id: this.userId,
      }
    );

    if (acceptError) {
      throw new Error(`Failed to accept invite: ${acceptError.message}`);
    }

    if (!success) {
      throw new Error(
        'Failed to accept invite - invite may be invalid or expired'
      );
    }

    this.logger.infoSync('Successfully accepted invite:', {
      inviteId: inviteData.id,
      listId: inviteData.list_id,
      userId: this.userId,
    });
  }

  async getListParticipants(_listId: string): Promise<UserProfile[]> {
    if (!this.userId) throw new Error('User not authenticated');

    // TODO: Implement participant retrieval
    throw new Error('Participant retrieval not yet implemented');
  }

  async removeParticipant(yjsDocumentId: string): Promise<void> {
    if (!this.userId) throw new Error('User not authenticated');

    this.logger.infoSync(`Removing participant from list:`, {
      yjsDocumentId,
      userId: this.userId,
    });

    // First, find the database ID for this YJS document ID
    const { data: listData, error: listError } = await this.supabase
      .from('lists')
      .select('id')
      .eq('yjs_document_id', yjsDocumentId)
      .single();

    if (listError) {
      this.logger.errorSync(
        `Failed to find list by YJS document ID:`,
        listError
      );
      throw new Error(`Failed to find list: ${listError.message}`);
    }

    if (!listData) {
      throw new Error(`List not found for YJS document ID: ${yjsDocumentId}`);
    }

    // Now remove the participant using the database ID
    const { error } = await this.supabase
      .from('list_participants')
      .delete()
      .eq('list_id', listData.id)
      .eq('user_id', this.userId);

    if (error) {
      this.logger.errorSync(`Failed to remove participant:`, error);
      throw new Error(`Failed to remove participant: ${error.message}`);
    }

    this.logger.infoSync(
      `Successfully removed participant from list: ${yjsDocumentId} (database ID: ${listData.id})`
    );
  }

  // Invite management
  async createInvite(
    request: CreateInviteRequest,
    userId?: string
  ): Promise<CreateInviteResponse> {
    const currentUserId = userId || this.userId;
    if (!currentUserId) throw new Error('User not authenticated');

    // Check current auth state
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser();
    this.logger.infoSync('Current auth state:', {
      currentUserId,
      supabaseUserId: user?.id,
      authError: authError?.message,
    });

    // Generate a unique token for the invite
    const token = generateUUID();

    // Get the list to ensure it exists and get the database id
    const { data: listData, error: listError } = await this.supabase
      .from('lists')
      .select('id, yjs_document_id, owner_id')
      .eq('yjs_document_id', request.listId)
      .is('deleted_by', null)
      .single();

    if (listError) {
      throw new Error(`List not found: ${listError.message}`);
    }

    // Verify the user is the owner of the list
    if (listData.owner_id !== currentUserId) {
      this.logger.errorSync('User is not the owner of the list:', {
        listOwnerId: listData.owner_id,
        currentUserId: currentUserId,
        listId: request.listId,
      });
      throw new Error('Only the list owner can create invites');
    }

    this.logger.infoSync('Creating invite with data:', {
      list_id: listData.id,
      yjs_document_id: listData.yjs_document_id,
      invited_by: currentUserId,
      invitation_for: request.invitationFor,
      token: token,
    });

    // Create the invite
    const { data, error } = await this.supabase
      .from('list_invites')
      .insert({
        list_id: listData.id, // Use the database id, not the yjs_document_id
        yjs_document_id: listData.yjs_document_id,
        invited_by: currentUserId,
        invitation_for: request.invitationFor,
        token: token,
        status: 'pending',
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(), // 7 days from now
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invite: ${error.message}`);
    }

    const invite: ListInvite = {
      id: data.id,
      listId: data.list_id,
      yjsDocumentId: data.yjs_document_id,
      invitedBy: data.invited_by,
      invitationFor: data.invitation_for,
      token: data.token,
      status: data.status,
      acceptedBy: data.accepted_by,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
    };

    const inviteUrl = `${window.location.origin}/manage/#/invite/${token}`;

    return {
      invite,
      inviteUrl,
    };
  }

  async getListInvites(listId: string, userId?: string): Promise<ListInvite[]> {
    const currentUserId = userId || this.userId;
    if (!currentUserId) throw new Error('User not authenticated');

    // First get the database id from the yjs_document_id
    const { data: listData, error: listError } = await this.supabase
      .from('lists')
      .select('id')
      .eq('yjs_document_id', listId)
      .is('deleted_by', null)
      .single();

    if (listError) {
      throw new Error(`List not found: ${listError.message}`);
    }

    const { data, error } = await this.supabase
      .from('list_invites')
      .select('*')
      .eq('list_id', listData.id)
      .eq('invited_by', currentUserId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get list invites: ${error.message}`);
    }

    return data.map(row => ({
      id: row.id,
      listId: row.list_id,
      yjsDocumentId: row.yjs_document_id,
      invitedBy: row.invited_by,
      invitationFor: row.invitation_for,
      token: row.token,
      status: row.status,
      acceptedBy: row.accepted_by,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
    }));
  }

  async getInviteByToken(token: string): Promise<ListInvite> {
    const { data, error } = await this.supabase
      .from('list_invites')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Invite not found');
      }
      throw new Error(`Failed to get invite: ${error.message}`);
    }

    return {
      id: data.id,
      listId: data.list_id,
      yjsDocumentId: data.yjs_document_id,
      invitedBy: data.invited_by,
      invitationFor: data.invitation_for,
      token: data.token,
      status: data.status,
      acceptedBy: data.accepted_by,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
    };
  }

  async revokeInvite(inviteId: string, userId?: string): Promise<void> {
    const currentUserId = userId || this.userId;
    if (!currentUserId) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('list_invites')
      .update({ status: 'expired' })
      .eq('id', inviteId)
      .eq('invited_by', currentUserId);

    if (error) {
      throw new Error(`Failed to revoke invite: ${error.message}`);
    }
  }
}
