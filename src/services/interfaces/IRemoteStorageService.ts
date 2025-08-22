import { List, UserProfile } from '@/types/List';
import {
  ListInvite,
  CreateInviteRequest,
  CreateInviteResponse,
} from '@/types/List';
import {
  YjsUpdate,
  YjsSnapshot,
} from '@/services/implementations/storage/SupabaseRemoteStorageService';

export interface AllUserLists {
  activeLists: List[];
  deletedLists: string[]; // Just the yjsDocumentIds for deleted lists
}

export interface IRemoteStorageService {
  // User management
  setUserId(userId: string): Promise<void>;
  getUserId(): string | null;

  // List discovery and permissions
  createList(yjsDocumentId: string): Promise<List>;
  listExists(yjsDocumentId: string): Promise<boolean>;
  getUserLists(): Promise<List[]>;
  getAllUserLists(since?: Date): Promise<AllUserLists>;
  deleteList(listId: string): Promise<void>;

  // CRDT sync operations
  pushUpdate(yjsDocumentId: string, update: YjsUpdate): Promise<void>;
  pullUpdates(
    yjsDocumentId: string,
    since?: Date,
    excludeClientId?: string
  ): Promise<YjsUpdate[]>;
  pushSnapshot(yjsDocumentId: string, snapshot: YjsSnapshot): Promise<void>;
  pullLatestSnapshot(yjsDocumentId: string): Promise<YjsSnapshot | null>;

  // Sharing operations
  shareList(listId: string, email: string): Promise<void>;
  acceptInvite(token: string): Promise<void>;
  getListParticipants(listId: string): Promise<UserProfile[]>;
  removeParticipant(listId: string): Promise<void>;

  // Invite management
  createInvite(
    request: CreateInviteRequest,
    userId?: string
  ): Promise<CreateInviteResponse>;
  getListInvites(listId: string, userId?: string): Promise<ListInvite[]>;
  getInviteByToken(token: string): Promise<ListInvite>;
  revokeInvite(inviteId: string, userId?: string): Promise<void>;
}
