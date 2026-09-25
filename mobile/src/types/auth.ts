export type EducationLevel = 'Intermediate' | 'Bachelors' | 'Masters' | 'PhD';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  university?: string;
  major?: string;
  studyStreak: number;
  longestStreak?: number;
  createdAt: string;
  lastLoginAt: string;
  hasCompletedOnboarding: boolean;
  isOnboarded?: boolean;
  isAnonymous?: boolean;
  username?: string;
  age?: number;
  gender?: string;
  educationLevel?: EducationLevel;
  totalStudyTimeMinutes?: number;
  quizzesTaken?: number;
  averageQuizScore?: number;
  totalMaterialsUploaded?: number;
  habitsCompleted?: number;
  customSubjects?: string[];
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  error: string | null;
}

