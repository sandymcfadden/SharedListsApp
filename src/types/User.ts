export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}
