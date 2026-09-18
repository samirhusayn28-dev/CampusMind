export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  university?: string;
  major?: string;
  studyStreak: number;
  createdAt: string;
  lastLoginAt: string;
  hasCompletedOnboarding: boolean;
  isAnonymous?: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  error: string | null;
}
