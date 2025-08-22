import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceContainer } from '@/services/container';
import { AuthUser, SignUpCredentials, SignInCredentials } from '@/types/User';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const authService = ServiceContainer.getInstance().getAuthService();
  const logger = ServiceContainer.getInstance().getLogService();
  const navigate = useNavigate();

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Set up auth state change listener first
    const unsubscribe = authService.onAuthStateChange(user => {
      if (mounted) {
        setState(prev => ({
          ...prev,
          user,
          loading: false,
          error: null,
        }));

        // Set user ID in remote storage service for sync operations
        if (user) {
          const serviceContainer = ServiceContainer.getInstance();
          const remoteStorage = serviceContainer.getRemoteStorageService();
          remoteStorage.setUserId(user.id).catch(error => {
            logger.errorSync('Failed to set user ID in remote storage:', error);
          });
        }
      }
    });

    // Then try to get current user (this will wait for initialization if needed)
    const initializeAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (mounted) {
          setState(prev => ({
            ...prev,
            user,
            loading: false,
          }));

          // User ID will be set by the auth state change listener above
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            error:
              error instanceof Error ? error.message : 'Authentication error',
            loading: false,
          }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [authService]);

  const signUp = useCallback(
    async (credentials: SignUpCredentials) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const user = await authService.signUp(credentials);
        setState(prev => ({
          ...prev,
          user,
          loading: false,
          error: null,
        }));
        return user;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Sign up failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [authService]
  );

  const signIn = useCallback(
    async (credentials: SignInCredentials) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Try to clean up any leftover data from previous sessions
        try {
          const serviceContainer = ServiceContainer.getInstance();
          const listController = serviceContainer.getListController();
          await listController.clearAllData();
        } catch (cleanupError) {
          // Ignore cleanup errors on sign in - this is just a best effort
          console.log(
            'Database cleanup on sign in failed (this is normal):',
            cleanupError
          );
        }

        const user = await authService.signIn(credentials);
        setState(prev => ({
          ...prev,
          user,
          loading: false,
          error: null,
        }));
        return user;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Sign in failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [authService]
  );

  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // First sign out from auth service (while session is still valid)
      try {
        await authService.signOut();
      } catch (authError) {
        // If auth signOut fails (e.g., session already expired), that's okay
        // We still want to clear local data and complete the logout
        console.log(
          'Auth signOut failed (session may already be expired):',
          authError
        );
      }

      // Then clear all local data
      const serviceContainer = ServiceContainer.getInstance();
      await serviceContainer.clearAllData();

      setState(prev => ({
        ...prev,
        user: null,
        loading: false,
        error: null,
      }));

      // Navigate to sign-out page after successful logout
      navigate('/signout');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Sign out failed';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [authService, navigate]);

  const updateProfile = useCallback(
    async (updates: { displayName?: string; avatarUrl?: string }) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const updatedUser = await authService.updateProfile(updates);
        setState(prev => ({
          ...prev,
          user: updatedUser,
          loading: false,
          error: null,
        }));
        return updatedUser;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Profile update failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [authService]
  );

  const resetPassword = useCallback(
    async (email: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        await authService.resetPassword(email);
        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Password reset failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [authService]
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const updatedUser = await authService.updatePassword(newPassword);
        setState(prev => ({
          ...prev,
          user: updatedUser,
          loading: false,
          error: null,
        }));
        return updatedUser;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Password update failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [authService]
  );

  const hasRecoverySession = useCallback(() => {
    return authService.hasRecoverySession();
  }, [authService]);

  const clearRecoverySession = useCallback(() => {
    authService.clearRecoverySession();
  }, [authService]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    hasRecoverySession,
    clearRecoverySession,
    clearError,
  };
}
