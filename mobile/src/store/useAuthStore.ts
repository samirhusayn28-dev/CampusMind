import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfile, EducationLevel } from '../types/auth';
import {
  auth,
  signInWithGoogleNative,
  signInAsGuest as firebaseSignInAsGuest,
  signOutUser,
  syncUserProfileToFirestore,
  configureGoogleSignIn,
  completeUserProfileOnboarding,
} from '../services/firebase';
import { loadCloudSettings, loadCloudHabits } from '../services/sync';
import { useHabitStore } from './useHabitStore';

const ONBOARDING_STORAGE_KEY = '@campusmind_onboarding_completed_v1';
const GUEST_STORAGE_KEY = '@campusmind_guest_user';

interface AuthStoreState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  error: string | null;

  // Actions
  initializeAuth: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  completeProfileOnboarding: (data: {
    username: string;
    age: number;
    gender: string;
    educationLevel: EducationLevel;
  }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  hasCompletedOnboarding: false,
  error: null,

  initializeAuth: async () => {
    try {
      configureGoogleSignIn();

      // Check onboarding state in AsyncStorage
      const onboardingValue = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      const hasCompleted = onboardingValue === 'true';

      // Check if guest user was previously active
      const cachedGuest = await AsyncStorage.getItem(GUEST_STORAGE_KEY);
      if (cachedGuest) {
        try {
          const parsedGuest = JSON.parse(cachedGuest) as UserProfile;
          set({
            user: parsedGuest,
            isAuthenticated: true,
            hasCompletedOnboarding: hasCompleted,
            isLoading: false,
          });
        } catch {
          // Fall through to Firebase auth listener
        }
      }

      // Listen to Firebase Auth state
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const profile = await syncUserProfileToFirestore(firebaseUser);
            loadCloudSettings(profile.uid).catch(() => {});
            loadCloudHabits(profile.uid, (data) => useHabitStore.getState().setHabitStateFromCloud(data)).catch(() => {});
            set({
              user: profile,
              isAuthenticated: true,
              hasCompletedOnboarding: hasCompleted || profile.hasCompletedOnboarding,
              isLoading: false,
              error: null,
            });
          } catch (err: any) {
            console.warn('[AuthStore] Failed syncing Firebase profile:', err);
            set({ isLoading: false });
          }
        } else if (!get().user?.isAnonymous) {
          set({
            user: null,
            isAuthenticated: false,
            hasCompletedOnboarding: hasCompleted,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }
      });
    } catch (err: any) {
      console.error('[AuthStore] Initialization error:', err);
      set({ isLoading: false, error: err.message });
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const profile = await signInWithGoogleNative();
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      loadCloudSettings(profile.uid).catch(() => {});
      loadCloudHabits(profile.uid, (data) => useHabitStore.getState().setHabitStateFromCloud(data)).catch(() => {});
      set({
        user: profile,
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Google Sign-In failed',
      });
      throw err;
    }
  },

  signInAsGuest: async (name: string = 'Campus Student') => {
    set({ isLoading: true, error: null });
    try {
      const profile = await firebaseSignInAsGuest(name);
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      set({
        user: profile,
        isAuthenticated: true,
        hasCompletedOnboarding: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Guest sign-in failed',
      });
      throw err;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await signOutUser();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  completeOnboarding: async () => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    set({ hasCompletedOnboarding: true });
  },

  completeProfileOnboarding: async (data: {
    username: string;
    age: number;
    gender: string;
    educationLevel: EducationLevel;
  }) => {
    const currentUser = get().user;
    if (!currentUser?.uid) return;
    set({ isLoading: true });
    try {
      const updatedProfile = await completeUserProfileOnboarding(currentUser.uid, data);
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      set({
        user: updatedProfile,
        hasCompletedOnboarding: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
