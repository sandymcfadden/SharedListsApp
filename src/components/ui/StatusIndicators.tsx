import React from 'react';
import { SyncStatus, BootstrapStatus, ConnectionState } from '@/types/AppState';

interface StatusIndicatorsProps {
  syncStatus: SyncStatus;
  connectionState: ConnectionState;
  bootstrapStatus: BootstrapStatus;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
  syncStatus,
  connectionState,
  bootstrapStatus,
}) => {
  return (
    <div className='fixed top-20 right-4 z-50 space-y-2'>
      {/* Sync status */}
      <div
        className={`
        flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
        ${
          syncStatus === 'synced'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : syncStatus === 'syncing'
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
              : 'bg-red-100 text-red-800 border border-red-200'
        }
      `}
      >
        <span
          className={`
          w-2 h-2 rounded-full
          ${
            syncStatus === 'synced'
              ? 'bg-green-500'
              : syncStatus === 'syncing'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
          }
        `}
        ></span>
        {syncStatus === 'synced'
          ? 'Synced'
          : syncStatus === 'syncing'
            ? 'Syncing...'
            : 'Offline'}
      </div>

      {/* Connection status */}
      <div
        className={`
        flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
        ${
          connectionState.isOnline
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }
      `}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connectionState.isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}
        ></span>
        {connectionState.isOnline ? 'Online' : 'Offline'}
        {!connectionState.browserOnline && ' (Browser)'}
        {!connectionState.realtimeConnected && ' (Realtime)'}
      </div>

      {/* Bootstrap status */}
      {bootstrapStatus !== 'idle' && (
        <div
          className={`
          flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
          ${
            bootstrapStatus === 'loading'
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : bootstrapStatus === 'complete'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
          }
        `}
        >
          <span
            className={`
            w-2 h-2 rounded-full
            ${
              bootstrapStatus === 'loading'
                ? 'bg-blue-500 animate-pulse'
                : bootstrapStatus === 'complete'
                  ? 'bg-green-500'
                  : 'bg-red-500'
            }
          `}
          ></span>
          {bootstrapStatus === 'loading'
            ? 'Loading lists...'
            : bootstrapStatus === 'complete'
              ? 'Lists loaded'
              : 'Load failed'}
        </div>
      )}
    </div>
  );
};
