# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SharedListsApp is an offline-first, real-time collaborative list management application built with React, TypeScript, Y.js (CRDT), and Supabase. Users can create, share, and collaborate on lists with automatic conflict resolution and offline support.

## Build and Development Commands

### Development
```bash
npm run dev                 # Start dev server (port 3000)
npm run build              # TypeScript compile + Vite build
npm run preview            # Preview production build
```

### Code Quality
```bash
npm run type:check         # TypeScript type checking (no emit)
npm run lint               # Run ESLint
npm run lint:fix           # Auto-fix ESLint issues
npm run format             # Format with Prettier
npm run format:check       # Check Prettier formatting
```

### Supabase (Local Development)
```bash
npm run supabase:start     # Start local Supabase stack (Docker)
npm run supabase:stop      # Stop local Supabase
npm run supabase:status    # Check Supabase status
npm run supabase:reset     # Reset local database
npm run supabase:push      # Push schema changes
npm run supabase:diff      # Show schema diff
```

### Deployment
```bash
npm run deploy             # Deploy to GitHub Pages
```

## Architecture

### Service Container Pattern
The application uses dependency injection via `ServiceContainer` (singleton). All major services are accessed through the container, which lazy-initializes services based on configuration from `src/services/config.ts`.

**Key principle**: Never instantiate services directly. Always use `ServiceContainer.getInstance().getXService()`.

```typescript
// Correct
const container = ServiceContainer.getInstance();
const authService = container.getAuthService();
const listController = container.getListController();

// Incorrect - don't do this
const authService = new SupabaseAuthService(...);
```

### Core Services
- **ListController** (`src/services/controllers/ListController.ts`) - Central business logic for all list operations. Coordinates between YjsListManager, repositories, sync queue, and event system.
- **YjsListManager** - Manages Y.js CRDT documents for collaborative editing. Each list is a separate Y.js document with automatic conflict resolution.
- **EventService** - In-memory pub/sub for component communication within a single tab.
- **BackgroundSyncService** - Processes offline sync queue when connection is restored.
- **RemoteUpdateHandler** - Listens to Supabase realtime channels and applies remote updates.
- **ConnectionMonitor** - Tracks online/offline state and realtime connection status.

### Data Flow for List Operations
All list operations follow this pattern:
1. **YjsListManager** - Update Y.js CRDT document (in-memory)
2. **ListRepository** - Persist to IndexedDB (local)
3. **ConnectionMonitor check** - If online, try real-time sync; if offline or sync fails, add to sync queue
4. **EventService** - Publish event for UI updates

Example from `ListController.createList()`:
```typescript
// 1. Update Y.js document
this.yjsListManager.createList(listId, name, description, currentUserId);

// 2. Persist to IndexedDB
await this.listRepository.saveList({ uuid: listId, data: yjsState });

// 3. Sync or queue
if (this.connectionMonitor.isOnline()) {
  try {
    await this.remoteStorageService.createList(listId);
    await this.remoteStorageService.pushUpdate(listId, ...);
  } catch {
    await this.syncQueueRepository.addListCreateItem(listId);
    await this.triggerBackgroundSync();
  }
} else {
  await this.syncQueueRepository.addListCreateItem(listId);
}

// 4. Publish event
this.eventService.publish({ type: EVENT_TYPES.LIST_CREATED, ... });
```

### Repository Pattern
Three repositories manage local storage (all use IndexedDB via `IndexedDBStorage`):
- **ListRepository** - Y.js document state persistence
- **MetadataRepository** - Sync metadata (client ID, last sync timestamps, applied updates)
- **SyncQueueRepository** - Offline operations queue (create, delete, update, leave actions)

### Y.js CRDT Structure
Each list is a Y.js document with:
- `meta` Y.Map: `{ title, description, ownerId, createdAt, updatedAt }`
- `items` Y.Array: Array of `{ id, content, isCompleted }`

Updates are serialized as `Uint8Array` using `Y.encodeStateAsUpdate()` and applied with `Y.applyUpdate()`.

### Path Aliases
Configure imports using TypeScript path aliases (defined in `tsconfig.json` and `vite.config.ts`):
```typescript
import { ServiceContainer } from '@/services/container';
import { useAuth } from '@/hooks/useAuth';
import { List } from '@/types/List';
import { formatDate } from '@/utils/formatDate';
```

### Routing
Uses React Router with **HashRouter** (not BrowserRouter) for GitHub Pages compatibility. Routes are defined in `src/App.tsx`.

### Environment Configuration
- `.env` file for local development (not committed)
- Required variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Optional PostHog variables: `VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST`
- Configuration loaded via `src/services/config.ts` and validated on container initialization

### Logging Configuration
The app supports two logging implementations:
- **ConsoleLogService** (default) - Logs to browser console with emojis and caller info
- **PostHogLogService** - Captures logs as events in PostHog for analytics

To switch logging implementations, update `src/services/config.ts`:
```typescript
logging: {
  type: 'posthog', // or 'console'
  level: LogLevel.INFO,
  enabled: true,
}
```

**Important**: When using PostHog logging, the configuration validator will check for required environment variables:
- `VITE_PUBLIC_POSTHOG_KEY` - PostHog API key (required)
- `VITE_PUBLIC_POSTHOG_HOST` - PostHog host URL (required)

The app will throw a configuration error on startup if these are missing when `type: 'posthog'` is set.

PostHog events are captured with properties including:
- `level` (debug/info/warn/error)
- `message` (log message)
- `caller` (file:line where log was called)
- `timestamp`
- `category` (for sync-related logs)
- `args` (serialized additional arguments)

### User Identification in PostHog

The `ILogService` interface includes `identifyUser()` and `resetUser()` methods for analytics tracking:

```typescript
// In App.tsx - automatically called on auth state change
logger.identifyUser(user.id, {
  email: user.email,
  display_name: user.displayName,
  avatar_url: user.avatarUrl,
});

// On sign out
logger.resetUser();
```

**Implementation details**:
- **PostHogLogService**: Calls `posthog.identify()` and `posthog.reset()` to track authenticated users
- **ConsoleLogService**: No-op implementations (does nothing)

This pattern ensures user identification only happens when using PostHog logging, without needing conditional checks throughout the codebase. The auth flow in [App.tsx](src/App.tsx:39-52) automatically handles identification when users sign in/out.

### Landing Page PostHog Integration

PostHog is also integrated on the landing page (`public/index.html`) for tracking anonymous visitors and A/B testing:

**Environment variable replacement**: The Vite config includes an `env-replacement` plugin that replaces `%VITE_PUBLIC_POSTHOG_KEY%` and `%VITE_PUBLIC_POSTHOG_HOST%` placeholders in HTML files during build.

**Events tracked on landing page** (see [landing.js](public/assets/landing.js)):
- `launch_app_clicked` - User clicked "Launch App" button
- `demo_video_viewed` - User scrolled to video section (tracked via IntersectionObserver)
- `invite_request_clicked` - User clicked "Request Invite" button (when survey feature flag enabled)
- `invite_request_submitted` - User submitted email via prompt (fallback when survey not configured)

**Feature flag: `beta-signup-survey`**
- **When enabled**: Shows "Request an Invite" button that triggers PostHog survey
- **When disabled**: Shows email link (`mailto:sandymc@gmail.com`)
- Checked in `public/assets/landing.js` via `posthog.isFeatureEnabled('beta-signup-survey')`

To configure the survey in PostHog dashboard:
1. Create a survey with type "Popover"
2. Set trigger to appear when `invite_request_clicked` event is captured
3. Add questions (e.g., email, intended use case)
4. Enable the `beta-signup-survey` feature flag to activate

### Event Tracking

The `ILogService` interface includes a `captureEvent()` method for tracking user actions and business events:

```typescript
// In ListController or other services
this.logger.captureEvent('list_created', {
  has_description: true,
});

this.logger.captureEvent('item_toggled');
```

**Implementation details**:
- **PostHogLogService**: Calls `posthog.capture(eventName, properties)` to track events in PostHog
- **ConsoleLogService**: Logs events to console with `📊 Event:` prefix for debugging

**Event naming convention**: Use `noun_verb` format (e.g., `list_created`, `item_toggled`, `items_cleared`)

**Currently tracked events** (see [ListController.ts](src/services/controllers/ListController.ts)):
- `list_created` - When a user creates a new list (includes `has_description` property)
- `list_deleted` - When a user deletes a list
- `item_added` - When a user adds an item to a list
- `item_toggled` - When a user marks an item as complete/incomplete
- `items_cleared` - When a user clears all completed items from a list

**Guidelines for adding new events**:
- Track user actions, not system events
- Avoid including sensitive data (list titles, item content, user names)
- Use boolean/numeric properties for aggregation (e.g., `has_description: true` instead of `description: "text"`)
- Keep property names consistent across events (e.g., always use `item_count` not `itemCount` or `num_items`)
- Always capture events, regardless of log level

## Important Patterns

### Adding a New List Operation
If adding a new operation (e.g., "archive list"):

1. **Add to YjsListManager** (`src/services/implementations/yjs/YjsListManager.ts`):
   ```typescript
   archiveList(listId: string): void {
     const doc = this.documents.get(listId);
     const meta = doc.getMap('meta');
     meta.set('isArchived', true);
     this.updateTimestamp(listId);
   }
   ```

2. **Add to IYjsListManager interface** (`src/services/interfaces/IYjsListManager.ts`)

3. **Add to ListController** (`src/services/controllers/ListController.ts`):
   - Update Y.js document
   - Save to repository
   - Check connection and sync or queue
   - Publish event

4. **Add sync queue support** to `SyncQueueRepository` if needed

5. **Add event type** to `src/types/EventTypes.ts`

6. **Update UI components** to handle the new event

### Bootstrap Process
When a user logs in, `ListController.bootstrapFromRemote()` is called:
1. Fetches all lists from remote storage
2. For each list, pulls YJS updates since last sync timestamp (incremental sync)
3. Applies updates to local YJS documents
4. Saves to IndexedDB
5. Publishes `LIST_CREATED` or `LIST_METADATA_CHANGED` events for UI updates
6. Emits `BOOTSTRAP_COMPLETED` event when done

**Important**: Use incremental sync with `lastSyncTimestamp` to avoid re-applying all updates. Only fetch updates since the last sync.

### Connection Handling
`ConnectionMonitor` tracks two states:
- `browserOnline`: Browser navigator.onLine status
- `realtimeConnected`: Supabase realtime connection status
- `isOnline()`: Returns `browserOnline && realtimeConnected`

**Always check connection before attempting remote operations**:
```typescript
if (this.connectionMonitor.isOnline()) {
  await this.remoteStorageService.someOperation();
} else {
  await this.syncQueueRepository.addToQueue(...);
}
```

### Sync Queue Processing
`BackgroundSyncService` periodically processes queued operations:
1. Gets all items from `SyncQueueRepository`
2. For each item, attempts remote operation based on `operationType`
3. If successful, removes from queue via `ListController.removeSyncQueueItem()`
4. If failed, leaves in queue for next attempt

## Database Schema (Supabase)

Key tables (see `supabase/migrations/` for full schema):
- `lists` - List metadata (id, owner_id, created_at, last_synced_at)
- `list_participants` - User permissions (list_id, user_id, role)
- `list_doc_updates` - Y.js updates (id, yjs_document_id, client_id, data, timestamp)
- `list_doc_snapshots` - Periodic snapshots for optimization (list_id, snapshot, seq)

RLS policies enforce:
- Users can only read/write lists they own or participate in
- List creators have full control
- Shared participants have read/write access

## Testing Approach

When making changes:
1. Start local Supabase stack: `npm run supabase:start`
2. Test offline mode: Use browser DevTools to simulate offline
3. Test sync: Go offline, make changes, go online, verify sync
4. Test collaboration: Open multiple tabs/browsers with same list
5. Check browser console for errors (LogService outputs to console)

## Common Gotchas

1. **Never modify Y.js arrays/maps directly** - Always use Y.js methods (`push`, `insert`, `delete`, `set`)
2. **Event handlers leak memory** - Always unsubscribe from EventService in useEffect cleanup
3. **IndexedDB is async** - All repository operations return Promises
4. **Client ID filtering** - When pulling updates, exclude your own client ID to avoid duplicate application
5. **Sync queue race conditions** - BackgroundSyncService may attempt to sync while UI is making changes. Operations are idempotent where possible.
6. **Bootstrap should not duplicate events** - Check if lists already exist locally before creating during bootstrap
7. **Hash routing** - Use `#/manage/lists` not `/manage/lists` for internal links due to HashRouter

## Deployment Notes

- Builds to `dist/` directory
- Landing page served at root (`index.html`)
- React app served at `/manage/` (`dist/manage/index.html`)
- Custom Vite plugin handles routing setup (see `vite.config.ts`)
- GitHub Pages deployment via `npm run deploy` (uses `gh-pages` package)
- Set Supabase production URL/key in GitHub Pages environment or use .env for other hosting
