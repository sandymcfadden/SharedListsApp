import { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { IAuthService } from '@/services/interfaces/IAuthService';
import { ILogService } from '@/services/interfaces/ILogService';
import { AuthUser, SignUpCredentials, SignInCredentials } from '@/types/User';
import { SupabaseClientSingleton } from './SupabaseClient';
import {
  parseHashParams,
  hasRecoveryParams,
  clearAuthParams,
} from '@/utils/urlUtils';

export class SupabaseAuthService implements IAuthService {
  private static sharedState: {
    isInitialized: boolean;
    currentUser: AuthUser | null;
    authStateCallbacks: Set<(user: AuthUser | null) => void>;
    supabaseListenerSetup: boolean;
    recoverySession: any | null;
  } | null = null;

  private supabase: SupabaseClient;
  private logger: ILogService;

  constructor(
    supabaseUrl: string,
    supabaseAnonKey: string,
    logger: ILogService
  ) {
    this.supabase = SupabaseClientSingleton.getInstance(
      supabaseUrl,
      supabaseAnonKey
    );
    this.logger = logger;

    // Initialize shared state if not already done
    if (!SupabaseAuthService.sharedState) {
      SupabaseAuthService.sharedState = {
        isInitialized: false,
        currentUser: null,
        authStateCallbacks: new Set(),
        supabaseListenerSetup: false,
        recoverySession: null,
      };
    }

    // Set up auth state listener only once
    if (!SupabaseAuthService.sharedState.supabaseListenerSetup) {
      SupabaseAuthService.sharedState.supabaseListenerSetup = true;

      this.supabase.auth.onAuthStateChange((event, session) => {
        if (SupabaseAuthService.sharedState) {
          // Handle password recovery event
          if (event === 'PASSWORD_RECOVERY') {
            // Store the recovery session for later use
            SupabaseAuthService.sharedState.recoverySession = session;
            return;
          }

          const newUser = session?.user
            ? this.mapSupabaseUserToAuthUser(session.user)
            : null;

          // Only notify if the user state actually changed
          const userChanged =
            SupabaseAuthService.sharedState.currentUser?.id !== newUser?.id;

          SupabaseAuthService.sharedState.isInitialized = true;
          SupabaseAuthService.sharedState.currentUser = newUser;

          // Only call callbacks if the user state changed
          if (userChanged) {
            SupabaseAuthService.sharedState.authStateCallbacks.forEach(
              callback => callback(SupabaseAuthService.sharedState!.currentUser)
            );
          }
        }
      });

      // Force an initial session check
      this.initializeSession();
    }
  }

  private async initializeSession() {
    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (SupabaseAuthService.sharedState) {
        const newUser = session?.user
          ? this.mapSupabaseUserToAuthUser(session.user)
          : null;

        // Only notify if the user state actually changed
        const userChanged =
          SupabaseAuthService.sharedState.currentUser?.id !== newUser?.id;

        SupabaseAuthService.sharedState.isInitialized = true;
        SupabaseAuthService.sharedState.currentUser = newUser;

        // Only notify listeners if the user state changed
        if (userChanged) {
          SupabaseAuthService.sharedState.authStateCallbacks.forEach(callback =>
            callback(SupabaseAuthService.sharedState!.currentUser)
          );
        }
      }
    } catch (error) {
      this.logger.errorSync('Error initializing session:', error);
      if (SupabaseAuthService.sharedState) {
        const userChanged =
          SupabaseAuthService.sharedState.currentUser !== null;

        SupabaseAuthService.sharedState.isInitialized = true;
        SupabaseAuthService.sharedState.currentUser = null;

        // Only notify listeners if the user state changed
        if (userChanged) {
          SupabaseAuthService.sharedState.authStateCallbacks.forEach(callback =>
            callback(null)
          );
        }
      }
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!SupabaseAuthService.sharedState) {
      return null;
    }

    // If we haven't been initialized yet, wait for auth state to be restored
    if (!SupabaseAuthService.sharedState.isInitialized) {
      // Return the cached user if available, or wait for initialization
      return new Promise(resolve => {
        if (SupabaseAuthService.sharedState?.currentUser) {
          resolve(SupabaseAuthService.sharedState.currentUser);
          return;
        }

        const timeout = setTimeout(() => {
          resolve(null);
        }, 5000); // 5 second timeout

        const unsubscribe = this.onAuthStateChange(user => {
          clearTimeout(timeout);
          unsubscribe();
          resolve(user);
        });
      });
    }

    return SupabaseAuthService.sharedState.currentUser;
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthUser> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            display_name: credentials.displayName,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('No user returned from sign up');
      }

      return this.mapSupabaseUserToAuthUser(data.user);
    } catch (error) {
      this.logger.errorSync('Sign up error:', error);
      throw error;
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthUser> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('No user returned from sign in');
      }

      return this.mapSupabaseUserToAuthUser(data.user);
    } catch (error) {
      this.logger.errorSync('Sign in error:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut({ scope: 'local' });

      if (error) {
        // Don't throw for session-related errors during logout
        if (
          error.message.includes('session') ||
          error.message.includes('Auth session missing')
        ) {
          this.logger.infoSync(
            'Session already expired during logout, continuing...',
            error
          );
          return;
        }
        throw new Error(error.message);
      }
    } catch (error) {
      // Don't throw for network or session errors during logout
      if (error instanceof Error) {
        if (
          error.message.includes('session') ||
          error.message.includes('Auth session missing') ||
          error.message.includes('403') ||
          error.message.includes('Forbidden')
        ) {
          this.logger.infoSync(
            'Session error during logout (expected):',
            error.message
          );
          return;
        }
      }
      this.logger.errorSync('Sign out error:', error);
      throw error;
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    if (!SupabaseAuthService.sharedState) {
      return () => {}; // No-op if shared state is not available
    }

    SupabaseAuthService.sharedState.authStateCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      SupabaseAuthService.sharedState?.authStateCallbacks.delete(callback);
    };
  }

  async refreshSession(): Promise<AuthUser | null> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        this.logger.errorSync('Error refreshing session:', error);
        return null;
      }

      return data.user ? this.mapSupabaseUserToAuthUser(data.user) : null;
    } catch (error) {
      this.logger.errorSync('Unexpected error refreshing session:', error);
      return null;
    }
  }

  private mapSupabaseUserToAuthUser(supabaseUser: SupabaseUser): AuthUser {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      displayName:
        supabaseUser.user_metadata?.display_name ||
        supabaseUser.user_metadata?.full_name,
      avatarUrl: supabaseUser.user_metadata?.avatar_url,
    };
  }

  // Static method to reset shared state (useful for testing)
  static reset(): void {
    SupabaseAuthService.sharedState = null;
    SupabaseClientSingleton.reset();
  }

  // Additional helper methods for Supabase-specific functionality
  async resetPassword(email: string): Promise<void> {
    try {
      // Construct the redirect URL - use localhost:3000 with /manage/ path
      // This matches the expected URL structure for the app
      const redirectUrl = `${window.location.origin}/manage/#/password-reset`;

      this.logger.infoSync('Sending password reset email to:', email);
      this.logger.infoSync('Redirect URL:', redirectUrl);

      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        this.logger.errorSync('Supabase resetPasswordForEmail error:', error);
        throw new Error(error.message);
      }

      this.logger.infoSync('Password reset email sent successfully');
    } catch (error) {
      this.logger.errorSync('Password reset error:', error);
      throw error;
    }
  }

  async updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<AuthUser> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        data: {
          display_name: updates.displayName,
          avatar_url: updates.avatarUrl,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('No user returned from profile update');
      }

      return this.mapSupabaseUserToAuthUser(data.user);
    } catch (error) {
      this.logger.errorSync('Profile update error:', error);
      throw error;
    }
  }

  async updatePassword(newPassword: string): Promise<AuthUser> {
    try {
      // Check if we have recovery parameters in the URL
      const hashParams = parseHashParams();

      if (hashParams.type === 'recovery' && hashParams.access_token) {
        this.logger.infoSync('Updating password using recovery token');

        // Set the session using the recovery token
        const { data: sessionData, error: sessionError } =
          await this.supabase.auth.setSession({
            access_token: hashParams.access_token,
            refresh_token: hashParams.refresh_token || '',
          });

        if (sessionError) {
          throw new Error(
            `Failed to set recovery session: ${sessionError.message}`
          );
        }

        if (!sessionData.session) {
          throw new Error('No session created from recovery token');
        }
      }

      // Now update the password
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('No user returned from password update');
      }

      this.logger.infoSync('Password updated successfully');
      return this.mapSupabaseUserToAuthUser(data.user);
    } catch (error) {
      this.logger.errorSync('Password update error:', error);
      throw error;
    }
  }

  hasRecoverySession(): boolean {
    // Check if there are recovery parameters in the URL hash
    return hasRecoveryParams();
  }

  clearRecoverySession(): void {
    // Clear the auth parameters from the URL
    clearAuthParams();

    if (SupabaseAuthService.sharedState) {
      SupabaseAuthService.sharedState.recoverySession = null;
    }
  }
}
