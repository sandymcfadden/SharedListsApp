import * as Y from 'yjs';

export interface List {
  id: string;
  yjsDocumentId: string; // The Yjs document UUID
  title?: string; // Optional since it's stored in CRDT
  description?: string; // Optional since it's stored in CRDT
  ownerId?: string;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

// Type-safe metadata interface
interface ListMetadata {
  title: string;
  description?: string;
  ownerId?: string;
  createdBy: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// Type-safe metadata map that extends Y.Map but provides better typing
export type YjsListMetadata = Y.Map<string> & {
  get(key: keyof ListMetadata): string | undefined;
  set(key: keyof ListMetadata, value: string): void;
};

// Use CollaborativeListItem instead of YjsListItemData (they're identical)
export type YjsListItemData = CollaborativeListItem;

// Statistics interface
export interface ListStatistics {
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
}

// Collaborative document types (moved from ICollaborativeDocService)
export interface CollaborativeListItem {
  id: string;
  content: string;
  isCompleted: boolean;
}

export interface CollaborativeDocument {
  id: string;
  title: string;
  description?: string;
  items: CollaborativeListItem[];
  statistics: ListStatistics;
  isConnected: boolean;
  isSynced: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  ownerId?: string; // Owner of the list
}

// List invitation types
export interface ListInvite {
  id: string;
  listId: string; // Database UUID (lists.id)
  yjsDocumentId: string; // Yjs document UUID for frontend routing
  invitedBy: string;
  invitationFor: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  acceptedBy?: string; // User ID who accepted the invite
  createdAt: Date;
  expiresAt: Date;
}

export interface CreateInviteRequest {
  listId: string;
  invitationFor: string;
}

export interface CreateInviteResponse {
  invite: ListInvite;
  inviteUrl: string;
}
