# Architecture Overview

SharedListsApp is built with a modern, scalable architecture that prioritizes offline-first functionality, real-time collaboration, and maintainability.

## 🏗️ System Architecture

### Core Principles

1. **Offline-First**: All operations work locally first, then sync when online
2. **CRDT-Based Collaboration**: Uses Y.js for conflict-free real-time collaboration
3. **Interface-Driven Design**: All major components are defined by interfaces
4. **Service Container**: Dependency injection for loose coupling and testability
5. **Event-Driven**: In-memory publish-subscribe for component communication

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │    │   Service       │    │   Storage       │
│   Components    │◄──►│   Layer         │◄──►│   Layer         │
│                 │    │                 │    │                 │
│ • Pages         │    │ • Controllers   │    │ • IndexedDB     │
│ • Hooks         │    │ • Services      │    │ • Supabase      │
│ • Components    │    │ • Interfaces    │    │ • Y.js CRDT     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Event System  │    │   Auth System   │    │   Sync System   │
│                 │    │                 │    │                 │
│ • Event Bus     │    │ • Supabase      │    │ • Real-time     │
│ • Publish/      │    │   Auth          │    │ • Offline Queue │
│   Subscribe     │    │ • Protected     │    │ • Conflict      │
│ • In-Memory     │    │   Routes        │    │   Resolution    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Key Components

### 1. Service Layer

The service layer provides a clean abstraction over external dependencies:

#### Service Interfaces
- `IAuthService` - Authentication and user management
- `IRealtimeService` - Real-time collaboration
- `IRemoteStorageService` - Remote data persistence
- `ILocalStorage` - Local data storage
- `IYjsListManager` - CRDT document management
- `IEventService` - Event handling and in-memory publish-subscribe

#### Service Container
The `ServiceContainer` implements dependency injection:

```typescript
class ServiceContainer {
  getAuthService(): IAuthService
  getRealtimeService(): IRealtimeService
  getRemoteStorageService(): IRemoteStorageService
  getLocalStorage(): ILocalStorage
  getYjsListManager(): IYjsListManager
  getEventService(): IEventService
}
```

### 2. Data Architecture

#### CRDT-First Design
- Each list is a separate Y.js document
- All list data (items, metadata) stored in CRDT
- Automatic conflict resolution
- Offline-first with local persistence

#### Storage Layers
1. **Custom IndexedDB**: CRDT document persistence using `idb` library
2. **Supabase**: Remote storage and real-time sync
3. **Local Storage**: Offline operations and caching

#### Database Schema
```sql
-- Core tables
lists (id, owner_id, created_at, last_synced_at)
list_participants (list_id, user_id, role)
list_doc_updates (list_id, seq, update, author, created_at)
list_doc_snapshots (list_id, snapshot, seq, created_at)
```

### 3. Real-time Collaboration

#### Y.js Integration
- Conflict-free replicated data types (CRDT)
- Automatic merging of concurrent edits
- Offline support with local persistence
- Real-time synchronization via Supabase

#### Sync Strategy
1. **Local Changes**: Immediately applied to Y.js document
2. **Remote Changes**: Received via Supabase real-time channels
3. **Conflict Resolution**: Handled automatically by Y.js
4. **Offline Queue**: Changes queued when offline, synced when online

### 4. Event System

#### In-Memory Publish-Subscribe
- App-wide communication for list management within a single tab
- Component-to-component communication
- Event-driven architecture for UI updates

#### Event Types
- List creation/deletion
- Item operations (add, update, delete, move)
- Sync status updates
- Error notifications

## 🔄 Data Flow

### 1. List Creation Flow

```
User Action → Controller → Service → Storage
     │            │          │         │
     ▼            ▼          ▼         ▼
Create List → ListController → YjsListManager → IndexedDB
     │            │          │         │
     ▼            ▼          ▼         ▼
UI Update ← Event Bus ← Publish-Subscribe ← Persistence
```

### 2. Real-time Sync Flow

```
User Edit → Y.js Document → Local Storage
     │            │              │
     ▼            ▼              ▼
UI Update → CRDT Update → IndexedDB
     │            │              │
     ▼            ▼              ▼
Event Publish → Supabase → Remote Users
```

### 3. Offline Sync Flow

```
Offline Edit → Local Queue → Online Detection
     │              │              │
     ▼              ▼              ▼
Local Storage → Sync Service → Remote Storage
     │              │              │
     ▼              ▼              ▼
UI Update ← Conflict Resolution ← Remote Users
```

## 🎯 Key Features Implementation

### Optimistic Updates
- UI updates immediately for instant feedback
- Automatic rollback on failure
- Loading states for better UX

### Offline-First
- All operations work without internet
- Local persistence with IndexedDB
- Automatic sync when connection restored

### Real-time Collaboration
- Y.js CRDT for conflict-free editing
- Supabase real-time channels
- Presence awareness

### Secure Sharing
- Invitation link generation
- Row-level security (RLS)
- Granular permissions

## 🔒 Security Architecture

### Authentication
- Supabase Auth integration
- JWT token management
- Protected routes

### Authorization
- Row-level security (RLS) policies
- User-based access control
- List-level permissions

## 🔧 Development Architecture

### Build System
- Vite for fast development
- TypeScript for type safety
- ESLint for code quality

### Deployment
- Static hosting ready
- Environment-based configuration
- CI/CD pipeline ready

This architecture provides a solid foundation for a collaborative, offline-first application that can scale with user needs while maintaining simplicity and reliability.
