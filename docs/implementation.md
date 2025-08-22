# Implementation Details

This document covers the key implementation details of SharedListsApp, including the event system, synchronization, real-time updates, and optimistic UI patterns.

## 📡 Event System

The event system provides an in-memory publish-subscribe pattern for component communication within a single tab. It enables loose coupling between components and services through event-driven architecture.

### Event Types

#### List Events
- `list_created` - New list created
- `list_deleted` - List deleted
- `list_title_changed` - List title updated
- `list_metadata_changed` - List metadata updated

#### Item Events
- `item_added` - New item added to list
- `item_deleted` - Item removed from list
- `item_content_changed` - Item content updated
- `item_completed` - Item marked as complete
- `item_uncompleted` - Item marked as incomplete
- `item_moved` - Item reordered

#### User Events
- `user_joined_list` - User added to list
- `user_left_list` - User removed from list

#### Connection Events
- `connection_established` - Connection to server established
- `connection_lost` - Connection to server lost
- `sync_completed` - Synchronization completed

### Event Hooks

#### Basic Event Subscription
```typescript
import { useEvents } from '@/hooks/useEvents';

function MyComponent() {
  const { subscribe, publish } = useEvents();

  useEffect(() => {
    const unsubscribe = subscribe(
      EVENT_TYPES.ITEM_ADDED,
      (event) => {
        console.log('Item added:', event.payload);
      }
    );

    return unsubscribe;
  }, [subscribe]);
}
```

#### List-Specific Events
```typescript
import { useListEvents } from '@/hooks/useEvents';

function ListComponent({ listId }: { listId: string }) {
  useListEvents(
    listId,
    (event) => {
      switch (event.type) {
        case EVENT_TYPES.ITEM_ADDED:
          // Handle item addition
          break;
        case EVENT_TYPES.ITEM_DELETED:
          // Handle item deletion
          break;
      }
    },
    { debounce: 300 }
  );
}
```

#### Item-Specific Events
```typescript
import { useItemEvents } from '@/hooks/useEvents';

function ItemComponent({ listId, itemId }: { listId: string; itemId: string }) {
  useItemEvents(
    listId,
    itemId,
    (event) => {
      switch (event.type) {
        case EVENT_TYPES.ITEM_CONTENT_CHANGED:
          // Handle content changes
          break;
        case EVENT_TYPES.ITEM_COMPLETED:
          // Handle completion
          break;
      }
    },
    { debounce: 100 }
  );
}
```

### Implementation Details

The event system uses a simple in-memory Map to store event subscriptions:

```typescript
export class EventService implements IEventService {
  // Event subscriptions stored in memory
  private eventSubscriptions = new Map<string, Set<EventHandler<Event>>>();

  publish(event: Event): void {
    // Notify all subscribers for this event type
    this.notifyEventSubscribers(event);
  }

  subscribe<T extends Event>(
    eventType: EventTypeString,
    handler: EventHandler<T>
  ): () => void {
    // Add handler to subscription set
    // Return unsubscribe function
  }
}
```

### Key Characteristics

- **In-Memory Only**: No cross-tab communication or persistence
- **Single Tab Scope**: Events only work within the current browser tab
- **Component Communication**: Enables loose coupling between React components
- **Service Integration**: Allows services to notify components of state changes

## 🔄 Synchronization System

The synchronization system handles offline-first operations with automatic conflict resolution using Y.js CRDT technology.

### Sync Flow

#### Bootstrap Process
1. **App loads** and calls `ListController.bootstrap()`
2. **Check for remote deletes** since last sync
3. **Get user lists** from remote storage
4. **For each list**:
   - If exists locally: sync recent changes
   - If new: pull from remote and create local document

#### Normal Sync Process
1. **Push local changes** to remote storage
2. **Pull remote changes** from other users
3. **Apply updates** using Y.js merge
4. **Update sync state** and timestamps

#### Offline Handling
1. **Track changes** in local storage
2. **Queue operations** for later sync
3. **Sync when online** with retry logic

### Implementation Details

#### Local Storage Architecture

The application uses a custom IndexedDB implementation built with the `idb` library. This provides more control over the storage schema and better integration with the service layer.

**Storage Schema:**
```typescript
interface AppDatabase extends DBSchema {
  lists: {
    key: string;
    value: {
      uuid: string;
      data: Uint8Array; // Y.js document state
    };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: Record<string, any>;
    };
  };
  syncQueue: {
    key: string;
    value: {
      uuid: string;
      listUUID: string;
      addedDate: Date;
    };
  };
}
```

**Key Benefits:**
- **Custom Schema**: Optimized for the application's specific needs
- **Service Integration**: Direct integration with the service container
- **Type Safety**: Full TypeScript support with proper typing
- **Performance**: Efficient storage and retrieval operations

#### Y.js Document Management
```typescript
class YjsListManager {
  async createDocument(listId: string): Promise<void> {
    const doc = new Y.Doc();
    
    // Initialize document structure
    const items = doc.getArray('items');
    const meta = doc.getMap('meta');
    
    // Store document in custom IndexedDB storage
    await this.localStorage.save({
      uuid: listId,
      data: Y.encodeStateAsUpdate(doc)
    });
    
    // Set up real-time sync
    const provider = new SupabaseYProvider(supabase, listId);
    provider.connect(doc);
  }
}
```

#### Sync Service
```typescript
class SyncService {
  async syncDocument(listId: string): Promise<void> {
    // Push local changes
    const unsyncedChanges = await this.getUnsyncedChanges(listId);
    for (const change of unsyncedChanges) {
      await this.remoteStorage.pushUpdate(listId, change);
    }
    
    // Pull remote changes
    const remoteUpdates = await this.remoteStorage.pullUpdates(listId);
    await this.applyRemoteUpdates(listId, remoteUpdates);
    
    // Update sync state
    await this.updateSyncState(listId);
  }
}
```

## ⚡ Real-time Updates

The real-time system provides instant synchronization across multiple clients by listening to database changes and CRDT updates.

### Architecture

#### Components
1. **IRealtimeService Interface** - Defines realtime service contract
2. **SupabaseRealtimeService** - Supabase implementation
3. **useRealtimeUpdates Hook** - React integration

#### Configuration
```typescript
export interface AppConfig {
  realtime: {
    type: 'supabase';
  };
}
```

### How It Works

#### Connection Setup
1. Connect to Supabase realtime service
2. Set up subscriptions to relevant database tables
3. Monitor connection status

#### Table Subscriptions
- **Lists Table**: `list_created`, `list_updated`, `list_deleted`
- **CRDT Updates Table**: `yjs_update` for document changes

#### Update Processing
1. Receive realtime update
2. Log for debugging
3. Trigger appropriate sync operations
4. Apply changes locally
5. Update UI

### Usage
```typescript
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

function MyComponent() {
  const { connectionStatus } = useRealtimeUpdates();
  
  return (
    <div>
      Connection: {connectionStatus}
    </div>
  );
}
```

### Benefits
- **Instant Updates**: Changes appear immediately
- **Reduced Latency**: No polling required
- **Better UX**: Real-time collaboration
- **Efficient**: Only relevant updates processed

## 🎯 Optimistic Updates

Optimistic updates provide instant UI feedback by immediately applying changes to the local state before confirming them with the server.

### Key Features

#### Instant UI Feedback
- Users see changes immediately
- No waiting for server responses
- Improved perceived performance

#### Automatic Rollback
- Failed operations revert UI to previous state
- Error messages inform users of failures
- Data consistency maintained

#### Loading States
- Individual operation loading states
- Buttons show loading text during operations
- Prevents duplicate operations

#### Debounced Updates
- Event subscriptions use debounced reloads
- Reduces server load and improves performance

### Implementation

#### Hook Integration
```typescript
export function useList(listId: string) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  
  const addItem = async (text: string) => {
    setIsAddingItem(true);
    
    try {
      // Optimistic update
      const newItem = { id: uuid(), text, completed: false };
      setItems(prev => [...prev, newItem]);
      
      // Server operation
      await listService.addItem(listId, text);
      
    } catch (error) {
      // Rollback on failure
      setItems(prev => prev.filter(item => item.id !== newItem.id));
      setError('Failed to add item');
    } finally {
      setIsAddingItem(false);
    }
  };
}
```

#### Component Usage
```typescript
function ListPage() {
  const { addItem, isAddingItem } = useList(listId);
  
  const handleAddItem = async () => {
    try {
      await addItem(newItemText.trim());
      setNewItemText(''); // Clear input on success
    } catch (error) {
      // Error already handled by hook
    }
  };
  
  return (
    <button 
      onClick={handleAddItem}
      disabled={isAddingItem}
    >
      {isAddingItem ? 'Adding...' : 'Add Item'}
    </button>
  );
}
```

### Error Handling

#### Rollback Strategy
1. **Store Previous State**: Before making optimistic changes
2. **Apply Optimistic Changes**: Immediately update UI
3. **Make API Call**: Send request to server
4. **Handle Response**:
   - **Success**: Keep optimistic changes
   - **Failure**: Restore previous state and show error

#### Error Messages
- User-friendly error messages displayed for 3 seconds
- Errors logged for debugging
- Users can retry failed operations

### Benefits

#### User Experience
- **Instant Feedback**: Users see changes immediately
- **Reduced Perceived Latency**: No waiting for server responses
- **Better Responsiveness**: App feels faster

#### Performance
- **Reduced Server Load**: Debounced updates prevent excessive API calls
- **Efficient Updates**: Event updates instead of full reloads
- **Optimized Network Usage**: Only necessary data fetched

#### Reliability
- **Data Consistency**: Failed operations automatically rolled back
- **Error Recovery**: Users can retry failed operations
- **Graceful Degradation**: App continues working with network issues

## 🔧 Service Integration

### Service Container
```typescript
class ServiceContainer {
  getAuthService(): IAuthService {
    return new SupabaseAuthService(this.config);
  }
  
  getRealtimeService(): IRealtimeService {
    return new SupabaseRealtimeService(this.config);
  }
  
  getRemoteStorageService(): IRemoteStorageService {
    return new SupabaseRemoteStorageService(this.config);
  }
}
```

### Hook Integration
```typescript
export function useList(listId: string) {
  const container = ServiceContainer.getInstance();
  const listService = container.getYjsListManager();
  const eventService = container.getEventService();
  
  // Use services in hook implementation
}
```

## 🔗 Invitation System

The invitation system allows list owners to share their lists with others through secure invitation links that can be shared via any method (email, text, etc.).

### How It Works

1. **Create Invitation**: List owner generates an invitation link
2. **Share Link**: Owner shares the link through any preferred method
3. **Accept Invitation**: Recipient clicks the link and accepts the invitation
4. **Access Granted**: Recipient gains access to the shared list

### Implementation Details

#### Creating Invitations
```typescript
const createInvite = async (listId: string, invitationFor: string) => {
  const response = await remoteStorage.createInvite({
    listId,
    invitationFor
  });
  
  // Returns: { invite: ListInvite, inviteUrl: string }
  return response.inviteUrl;
};
```

#### Accepting Invitations
```typescript
const acceptInvite = async (token: string) => {
  await remoteStorage.acceptInvite(token);
  // User is now added to the list participants
};
```

### Key Features

- **Flexible Sharing**: Invitation links can be shared via email, text, social media, etc.
- **Secure Tokens**: Each invitation has a unique, secure token
- **Expiration Support**: Invitations can have expiration dates
- **Revocation**: List owners can revoke invitations
- **Access Control**: Only list owners can create invitations

This implementation provides a robust foundation for a collaborative, offline-first application with real-time synchronization and optimistic UI updates.
