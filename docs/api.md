# API Reference

This document provides a comprehensive reference for all service interfaces, types, and APIs in SharedListsApp.

## 🔧 Service Interfaces

### IAuthService

Handles user authentication and session management.

```typescript
interface IAuthService {
  // Authentication
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  
  // Session management
  getCurrentUser(): Promise<User | null>;
  isAuthenticated(): Promise<boolean>;
  
  // User management
  updateProfile(updates: Partial<UserProfile>): Promise<UserProfile>;
  deleteAccount(): Promise<void>;
}
```

#### Methods

- `signIn(email, password)` - Authenticate user with email and password
- `signUp(email, password)` - Create new user account
- `signOut()` - Sign out current user
- `getCurrentUser()` - Get current authenticated user
- `isAuthenticated()` - Check if user is authenticated
- `updateProfile(updates)` - Update user profile information
- `deleteAccount()` - Delete user account and all data

### IRealtimeService

Manages real-time collaboration and synchronization.

```typescript
interface IRealtimeService {
  // Connection management
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Subscriptions
  subscribeToTable(table: string, callback: (payload: any) => void): () => void;
  subscribeToChannel(channel: string, callback: (payload: any) => void): () => void;
  
  // Real-time messaging
  broadcast(channel: string, event: string, payload: any): Promise<void>;
}
```

#### Methods

- `disconnect()` - Close connection to real-time service
- `isConnected()` - Check connection status
- `subscribeToTable(table, callback)` - Subscribe to database table changes
- `subscribeToChannel(channel, callback)` - Subscribe to custom channel
- `broadcast(channel, event, payload)` - Send real-time message to channel

### IRemoteStorageService

Handles remote data persistence and synchronization.

```typescript
interface IRemoteStorageService {
  // List management
  createList(listData: CreateListData): Promise<List>;
  getList(listId: string): Promise<List | null>;
  getUserLists(): Promise<List[]>;
  updateList(listId: string, updates: UpdateListData): Promise<List>;
  deleteList(listId: string): Promise<void>;
  
  // Sharing
  shareList(listId: string, email: string): Promise<void>;
  acceptInvite(token: string): Promise<void>;
  getListParticipants(listId: string): Promise<UserProfile[]>;
  removeParticipant(listId: string): Promise<void>;

  // Invitation link management
  createInvite(
    request: CreateInviteRequest,
    userId?: string
  ): Promise<CreateInviteResponse>;
  getListInvites(listId: string, userId?: string): Promise<ListInvite[]>;
  getInviteByToken(token: string): Promise<ListInvite>;
  revokeInvite(inviteId: string, userId?: string): Promise<void>;
  
  // CRDT operations
  pushUpdate(listId: string, update: Uint8Array): Promise<void>;
  pullUpdates(listId: string, since?: Date): Promise<CRDTUpdate[]>;
  
  // Sync metadata
  getSyncState(listId: string): Promise<SyncState | null>;
  updateSyncState(listId: string, state: SyncState): Promise<void>;
}
```

#### Methods

- `createList(listData)` - Create new list in remote storage
- `getList(listId)` - Get list by ID
- `getUserLists()` - Get all lists for current user
- `updateList(listId, updates)` - Update list metadata
- `deleteList(listId)` - Delete list from remote storage
- `shareList(listId, email)` - Share list with user
- `acceptInvite(token)` - Accept invitation using token
- `createInvite(request, userId)` - Create invitation link
- `getInviteByToken(token)` - Get invitation details by token
- `revokeInvite(inviteId, userId)` - Revoke invitation
- `getListParticipants(listId)` - Get list participants
- `removeParticipant(listId, userId)` - Remove participant from list
- `pushUpdate(listId, update)` - Push CRDT update to remote
- `pullUpdates(listId, since)` - Pull CRDT updates from remote
- `getSyncState(listId)` - Get synchronization state
- `updateSyncState(listId, state)` - Update synchronization state

### ILocalStorage

Manages local data storage and offline operations.

```typescript
interface ILocalStorage {
  // Lists
  saveList(list: List): Promise<void>;
  getList(listId: string): Promise<List | null>;
  getAllLists(): Promise<List[]>;
  deleteList(listId: string): Promise<void>;
  
  // List items
  saveListItem(item: ListItem): Promise<void>;
  getListItems(listId: string): Promise<ListItem[]>;
  deleteListItem(itemId: string): Promise<void>;
  
  // Sync metadata
  saveSyncMetadata(listId: string, metadata: SyncMetadata): Promise<void>;
  getSyncMetadata(listId: string): Promise<SyncMetadata | null>;
  
  // Offline operations
  queueOperation(operation: OfflineOperation): Promise<void>;
  getPendingOperations(listId?: string): Promise<OfflineOperation[]>;
  clearOperation(operationId: string): Promise<void>;
  
  // General storage
  setItem<T>(key: string, value: T): Promise<void>;
  getItem<T>(key: string): Promise<T | null>;
  clear(): Promise<void>;
}
```

#### Methods

- `saveList(list)` - Save list to local storage
- `getList(listId)` - Get list from local storage
- `getAllLists()` - Get all lists from local storage
- `deleteList(listId)` - Delete list from local storage
- `saveListItem(item)` - Save list item to local storage
- `getListItems(listId)` - Get all items for a list
- `deleteListItem(itemId)` - Delete list item from local storage
- `saveSyncMetadata(listId, metadata)` - Save sync metadata
- `getSyncMetadata(listId)` - Get sync metadata
- `queueOperation(operation)` - Queue offline operation
- `getPendingOperations(listId)` - Get pending operations
- `clearOperation(operationId)` - Clear completed operation
- `setItem(key, value)` - Set generic key-value pair
- `getItem(key)` - Get generic value by key
- `clear()` - Clear all local storage

### IYjsListManager

Manages Y.js CRDT documents for collaborative editing.

```typescript
interface IYjsListManager {
  // Document lifecycle
  createDocument(listId: string): Promise<void>;
  loadDocument(listId: string): Promise<YjsDocument | null>;
  destroyDocument(listId: string): Promise<void>;
  
  // CRDT operations
  addItem(listId: string, item: CreateListItemData): Promise<void>;
  updateItem(listId: string, itemId: string, updates: UpdateListItemData): Promise<void>;
  deleteItem(listId: string, itemId: string): Promise<void>;
  moveItem(listId: string, itemId: string, newIndex: number): Promise<void>;
  
  // Document state
  getDocumentState(listId: string): Promise<YjsDocumentState | null>;
  subscribeToDocument(listId: string, callback: (state: YjsDocumentState) => void): () => void;
  
  // Sync operations
  syncDocument(listId: string): Promise<void>;
  getUnsyncedChanges(listId: string): Promise<CRDTUpdate[]>;
}
```

#### Methods

- `createDocument(listId)` - Create new Y.js document
- `loadDocument(listId)` - Load existing Y.js document
- `destroyDocument(listId)` - Destroy Y.js document
- `addItem(listId, item)` - Add item to CRDT document
- `updateItem(listId, itemId, updates)` - Update item in CRDT document
- `deleteItem(listId, itemId)` - Delete item from CRDT document
- `moveItem(listId, itemId, newIndex)` - Move item to new position
- `getDocumentState(listId)` - Get current document state
- `subscribeToDocument(listId, callback)` - Subscribe to document changes
- `syncDocument(listId)` - Synchronize document with remote
- `getUnsyncedChanges(listId)` - Get unsynced local changes

### IEventService

Handles in-memory event publishing and subscription for component communication.

```typescript
interface IEventService {
  // Event publishing
  publish(event: Event): void;
  
  // Event subscription
  subscribe<T extends Event>(
    eventType: EventTypeString,
    handler: EventHandler<T>
  ): () => void;
  
  // Subscribe to all list events
  subscribeToListEvents(handler: EventHandler<Event>): () => void;
  
  // Cleanup
  clearAllSubscriptions(): void;
}
```

#### Methods

- `publish(event)` - Publish event to all subscribers in current tab
- `subscribe(eventType, handler)` - Subscribe to specific event type
- `subscribeToListEvents(handler)` - Subscribe to all list-related events
- `clearAllSubscriptions()` - Clear all event subscriptions

## 📊 Data Types

### Core Entities

#### User
```typescript
interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### List
```typescript
interface List {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  participants?: ListParticipant[];
}
```

#### ListItem
```typescript
interface ListItem {
  id: string;
  listId: string;
  content: string;
  isCompleted: boolean;
  addedBy: string;
  completedBy?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

#### ListParticipant
```typescript
interface ListParticipant {
  listId: string;
  userId: string;
  role: 'owner' | 'participant';
  addedAt: Date;
  user?: User;
}
```

#### ListInvite
```typescript
interface ListInvite {
  id: string;
  listId: string; // Database UUID (lists.id)
  yjsDocumentId: string; // Yjs document UUID for frontend routing
  invitedBy: string;
  invitationFor: string;
  token: string;
  createdAt: Date;
  expiresAt?: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
}
```

#### CreateInviteRequest
```typescript
interface CreateInviteRequest {
  listId: string;
  invitationFor: string;
}
```

#### CreateInviteResponse
```typescript
interface CreateInviteResponse {
  invite: ListInvite;
  inviteUrl: string;
}
```

### CRDT Types

#### YjsDocument
```typescript
interface YjsDocument {
  id: string;
  ydoc: Y.Doc;
  ylist: Y.Array<Y.Map<any>>;
  ymeta: Y.Map<any>;
  provider?: YjsSyncProvider;
}
```

#### YjsDocumentState
```typescript
interface YjsDocumentState {
  listId: string;
  title: string;
  items: ListItem[];
  metadata: Record<string, any>;
  lastModified: Date;
  isConnected: boolean;
  isSynced: boolean;
}
```

#### CRDTUpdate
```typescript
interface CRDTUpdate {
  id: string;
  listId: string;
  data: Uint8Array;
  author: string;
  timestamp: Date;
  applied: boolean;
}
```

### Event Types

#### Event
```typescript
interface Event {
  type: string;
  payload: any;
  timestamp: Date;
  source?: string;
}
```

#### EventFilter
```typescript
interface EventFilter {
  listId?: string;
  itemId?: string;
  userId?: string;
  since?: Date;
  until?: Date;
}
```


### Sync Types

#### SyncState
```typescript
interface SyncState {
  listId: string;
  lastSyncAt: Date;
  lastSyncSeq: number;
  isOnline: boolean;
  pendingChanges: number;
}
```

#### SyncMetadata
```typescript
interface SyncMetadata {
  listId: string;
  lastSyncAt: Date;
  lastSyncSeq: number;
  unsyncedChanges: string[];
  appliedRemoteUpdates: string[];
}
```

#### OfflineOperation
```typescript
interface OfflineOperation {
  id: string;
  type: 'add_item' | 'update_item' | 'delete_item' | 'toggle_item' | 'reorder_items' | 'update_title';
  listId: string;
  data: any;
  timestamp: Date;
  retryCount: number;
}
```

## 🎣 React Hooks

### useAuth
```typescript
function useAuth(): {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}
```

### useList
```typescript
function useList(listId: string): {
  list: List | null;
  items: ListItem[];
  title: string;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  isSynced: boolean;
  addItem: (text: string) => Promise<void>;
  updateItem: (itemId: string, updates: Partial<ListItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  toggleItem: (itemId: string) => Promise<void>;
  moveItem: (itemId: string, newIndex: number) => Promise<void>;
  setTitle: (title: string) => Promise<void>;
}
```

### useLists
```typescript
function useLists(): {
  lists: List[];
  isLoading: boolean;
  error: string | null;
  createList: (title: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  createInvite: (listId: string, invitationFor: string) => Promise<CreateInviteResponse>;
}
```

### useEvents
```typescript
function useEvents(): {
  subscribe: <T extends Event>(eventType: EventTypeString, handler: EventHandler<T>) => () => void;
  publish: (event: Event) => void;
}
```

### useListEvents
```typescript
function useListEvents(
  listId: string,
  callback: (event: Event) => void,
  options?: { debounce?: number; throttle?: number }
): void;
```

### useItemEvents
```typescript
function useItemEvents(
  listId: string,
  itemId: string,
  callback: (event: Event) => void,
  options?: { debounce?: number; throttle?: number }
): void;
```

### useRealtimeUpdates
```typescript
function useRealtimeUpdates(): {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  isOnline: boolean;
  lastSyncAt: Date | null;
}
```

## 🔧 Service Container

### ServiceContainer
```typescript
class ServiceContainer {
  static getInstance(): ServiceContainer;
  
  // Service getters
  getAuthService(): IAuthService;
  getRealtimeService(): IRealtimeService;
  getRemoteStorageService(): IRemoteStorageService;
  getLocalStorage(): ILocalStorage;
  getYjsListManager(): IYjsListManager;
  getEventService(): IEventService;
  
  // Configuration
  getConfig(): AppConfig;
  updateConfig(config: Partial<AppConfig>): void;
}
```

## 🚀 Usage Examples

### Basic List Operations
```typescript
import { useList } from '@/hooks/useList';

function ListPage({ listId }: { listId: string }) {
  const { 
    items, 
    addItem, 
    updateItem, 
    deleteItem, 
    toggleItem 
  } = useList(listId);
  
  const handleAddItem = async (text: string) => {
    try {
      await addItem(text);
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };
  
  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          <input 
            type="checkbox" 
            checked={item.isCompleted}
            onChange={() => toggleItem(item.id)}
          />
          <span>{item.content}</span>
          <button onClick={() => deleteItem(item.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Event Subscription
```typescript
import { useListEvents } from '@/hooks/useEvents';

function ListComponent({ listId }: { listId: string }) {
  useListEvents(
    listId,
    (event) => {
      switch (event.type) {
        case 'item_added':
          console.log('Item added:', event.payload);
          break;
        case 'item_deleted':
          console.log('Item deleted:', event.payload);
          break;
      }
    },
    { debounce: 300 }
  );
  
  return <div>List content</div>;
}
```

### Service Usage
```typescript
import { ServiceContainer } from '@/services/container';

const container = ServiceContainer.getInstance();
const authService = container.getAuthService();
const listService = container.getYjsListManager();

// Use services directly
const user = await authService.getCurrentUser();
await listService.createDocument('list-123');
```

This API reference provides comprehensive documentation for all interfaces, types, and usage patterns in SharedListsApp. For more specific examples and implementation details, refer to the source code and other documentation files.
