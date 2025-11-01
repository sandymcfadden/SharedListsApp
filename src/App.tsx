import { useState, useEffect, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import ListPage from '@/pages/ListPage';
import { AuthPage } from '@/pages/AuthPage';
import { PasswordResetPage } from '@/pages/PasswordResetPage';
import { PasswordResetRedirect } from '@/pages/PasswordResetRedirect';
import { SignOutPage } from '@/pages/SignOutPage';
import InviteAcceptancePage from '@/pages/InviteAcceptancePage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { StatusIndicators } from '@/components/ui/StatusIndicators';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Header } from '@/components/ui/Header';
import { useAuth } from '@/hooks/useAuth';
import { SyncStatus, BootstrapStatus, ConnectionState } from '@/types/AppState';

import { ServiceContainer } from '@/services/container';

function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [bootstrapStatus, setBootstrapStatus] =
    useState<BootstrapStatus>('idle');
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    browserOnline: navigator.onLine,
    realtimeConnected: false,
    isOnline: false,
  });

  const { user, loading: authLoading } = useAuth();

  // Use useMemo to prevent recreating these on every render
  const serviceContainer = useMemo(() => ServiceContainer.getInstance(), []);
  const logger = useMemo(
    () => serviceContainer.getLogService(),
    [serviceContainer]
  );

  // Handle user identification for analytics (PostHog)
  useEffect(() => {
    if (user) {
      // Identify user in logging service (PostHog will handle this, Console will no-op)
      logger.identifyUser(user.id, {
        email: user.email,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
      });
    } else {
      // Reset user identification on sign out
      logger.resetUser();
    }
  }, [user, logger]);

  useEffect(() => {
    // Only initialize app when user is authenticated and not already initialized
    if (!user || authLoading || isInitialized) {
      return;
    }

    const initializeApp = async () => {
      setSyncStatus('syncing');
      try {
        // Initialize the new list controller
        const listController = serviceContainer.getListController();

        // Load local lists first
        await listController.getAllLists(); // This will load all lists from local storage

        // Start remote update handler first to establish realtime connection
        const remoteUpdateHandler = serviceContainer.getRemoteUpdateHandler();
        await remoteUpdateHandler.start();

        // Start connection monitor after realtime service
        const connectionMonitor = serviceContainer.getConnectionMonitor();
        connectionMonitor.start();

        // Listen to connection state changes
        connectionMonitor.onConnectionChange(state => {
          setConnectionState(prevState => {
            // Only log significant state changes, not every update
            if (state.isOnline !== prevState.isOnline) {
              logger.infoSync('Connection state changed:', {
                isOnline: state.isOnline,
                browserOnline: state.browserOnline,
                realtimeConnected: state.realtimeConnected,
              });
            }
            return state;
          });
        });

        // Wait a moment for connection to be established
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Bootstrap from remote server if online
        try {
          setBootstrapStatus('loading');
          await listController.bootstrapFromRemote();
          logger.infoSync('Bootstrap completed successfully');
          setBootstrapStatus('complete');

          // Give UI a moment to update with new lists
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (bootstrapError) {
          logger.warnSync(
            'Failed to bootstrap from remote server:',
            bootstrapError
          );
          setBootstrapStatus('error');
          // Continue with local data only
        }

        // Start background sync service (lazy initialization)
        const backgroundSyncService =
          serviceContainer.getBackgroundSyncService();
        await backgroundSyncService.start();

        setSyncStatus('synced');
        setIsInitialized(true);
      } catch (error) {
        logger.errorSync('Error initializing app:', error);
        setSyncStatus('offline');
        setIsInitialized(true); // Mark as initialized even on error to prevent retries
      }
    };

    initializeApp();
  }, [user, authLoading, serviceContainer, logger, isInitialized]);

  // Reset bootstrap flag and initialization state when user changes
  useEffect(() => {
    if (!user) {
      setBootstrapStatus('idle');
      setIsInitialized(false);
    }
  }, [user]);

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header - Always visible */}
      <Header />

      {/* Status indicators */}
      {import.meta.env.MODE === 'development' && (
        <StatusIndicators
          syncStatus={syncStatus}
          connectionState={connectionState}
          bootstrapStatus={bootstrapStatus}
        />
      )}

      {/* Main content - Adjusted for fixed header */}
      <div className='container mx-auto px-4 py-8 pt-24'>
        <Routes>
          {/* Public routes - always accessible */}
          <Route path='/auth' element={<AuthPage />} />
          <Route path='/reset-password' element={<PasswordResetPage />} />
          <Route path='/password-reset' element={<PasswordResetPage />} />
          <Route path='/signout' element={<SignOutPage />} />
          <Route path='/invite/:token' element={<InviteAcceptancePage />} />
          {/* Root route - handle password reset redirect or go to lists */}
          <Route path='/' element={<PasswordResetRedirect />} />
          <Route
            path='/lists'
            element={
              authLoading ? (
                <LoadingSpinner message='Loading...' />
              ) : (
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              )
            }
          />
          <Route
            path='/list/:listId'
            element={
              authLoading ? (
                <LoadingSpinner message='Loading...' />
              ) : (
                <ProtectedRoute>
                  <ListPage />
                </ProtectedRoute>
              )
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;
