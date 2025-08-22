import { AuthUser, SignUpCredentials, SignInCredentials } from '@/types/User';

export interface IAuthService {
  /**
   * Get current authenticated user
   */
  getCurrentUser(): Promise<AuthUser | null>;

  /**
   * Sign up a new user
   */
  signUp(credentials: SignUpCredentials): Promise<AuthUser>;

  /**
   * Sign in an existing user
   */
  signIn(credentials: SignInCredentials): Promise<AuthUser>;

  /**
   * Sign out current user
   */
  signOut(): Promise<void>;

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void;

  /**
   * Refresh current session
   */
  refreshSession(): Promise<AuthUser | null>;

  /**
   * Update user profile information
   */
  updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<AuthUser>;

  /**
   * Send password reset email
   */
  resetPassword(email: string): Promise<void>;

  /**
   * Update user password (used during password recovery)
   */
  updatePassword(newPassword: string): Promise<AuthUser>;

  /**
   * Check if there's a password recovery session
   */
  hasRecoverySession(): boolean;

  /**
   * Clear password recovery session
   */
  clearRecoverySession(): void;
}
