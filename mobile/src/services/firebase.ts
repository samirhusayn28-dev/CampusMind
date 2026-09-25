import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - getReactNativePersistence is available in react-native entry
import { initializeAuth, getReactNativePersistence, getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { UserProfile, EducationLevel } from '../types/auth';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || (Platform.OS === 'ios'
    ? 'AIzaSyAQtPyaGahRTpYT_EfVPmIjDnT7nmjIfx4'
    : 'AIzaSyCblXoyveX8NqcGH19Hg5YMoAuaSWOuC7U'),
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'campusmind-d65c1.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'campusmind-d65c1',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'campusmind-d65c1.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '220472508393',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || (Platform.OS === 'ios'
    ? '1:220472508393:ios:490506b3a5ad90bad2d578'
    : '1:220472508393:android:d9de82b3808138e8d2d578'),
};

// Client IDs for Native Google Sign-In
export const GOOGLE_CONFIG = {
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '220472508393-0kviptkk3bo3a8sv9qi19qluiuj4pq7q.apps.googleusercontent.com',
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    '220472508393-m63rfu8n1ul1l613u1i7oblae4n3moav.apps.googleusercontent.com',
};

// Safely resolve GoogleSignin at runtime so module evaluation never throws at top level
let GoogleSignin: any = null;
let statusCodes: any = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = gModule.GoogleSignin;
  if (gModule.statusCodes) {
    statusCodes = gModule.statusCodes;
  }
} catch (e) {
  console.warn('[GoogleAuth] Native GoogleSignin module unavailable:', e);
}

export { statusCodes };

// Initialize Firebase App
let appInstance: any;
try {
  appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  console.warn('[Firebase] App initialization fallback:', e);
  appInstance = {} as any;
}
export const app = appInstance;

// Initialize Auth with AsyncStorage Persistence
let authInstance: any;
try {
  if (typeof getReactNativePersistence === 'function') {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    authInstance = getAuth(app);
  }
} catch {
  try {
    authInstance = getAuth(app);
  } catch {
    authInstance = {} as any;
  }
}

export const auth = authInstance;

let dbInstance: any;
try {
  dbInstance = getFirestore(app);
} catch {
  dbInstance = {} as any;
}
export const db = dbInstance;

// Configure GoogleSignin once at startup
let isGoogleSigninConfigured = false;
export function configureGoogleSignIn(): void {
  if (isGoogleSigninConfigured) return;
  if (!GoogleSignin || typeof GoogleSignin.configure !== 'function') {
    console.warn('[GoogleAuth] Native GoogleSignin not available on this device');
    return;
  }
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_CONFIG.webClientId,
      iosClientId: GOOGLE_CONFIG.iosClientId,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    isGoogleSigninConfigured = true;
  } catch (error) {
    console.warn('[GoogleAuth] Configuration failed or not in native runtime:', error);
  }
}

// Native Google Sign-In (using Google Play Services on Android / Native SDK on iOS)
export async function signInWithGoogleNative(): Promise<UserProfile> {
  configureGoogleSignIn();

  try {
    // Check if device has Google Play Services
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Trigger native sign-in dialog
    const response = await GoogleSignin.signIn();
    
    // In newer versions of @react-native-google-signin/google-signin, response structure is response.data
    const idToken = (response as any)?.data?.idToken || (response as any)?.idToken;

    if (!idToken) {
      throw new Error('Google Sign-In failed. Please check your internet connection and try again.');
    }

    // Exchange Google ID Token with Firebase
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    // Sync user data to Firestore
    const profile = await syncUserProfileToFirestore(firebaseUser);
    return profile;
  } catch (error: any) {
    // Log full error details to console only (never in UI)
    console.error('[GoogleAuth Error]', {
      code: error?.code,
      message: error?.message,
      nativeError: error,
      stack: error?.stack,
    });

    const code = String(error?.code || '');
    const msg = String(error?.message || '').toLowerCase();

    // 1. User cancelled
    if (
      code === statusCodes?.SIGN_IN_CANCELLED ||
      code === 'SIGN_IN_CANCELLED' ||
      code === '12501' ||
      msg.includes('cancel')
    ) {
      throw new Error('Google Sign-In was cancelled.');
    }

    // 2. Sign-in already in progress
    if (
      code === statusCodes?.IN_PROGRESS ||
      code === 'IN_PROGRESS' ||
      code === '12502' ||
      msg.includes('in progress')
    ) {
      throw new Error('Google Sign-In is already in progress. Please check your open prompt.');
    }

    // 3. Google Play Services unavailable or outdated
    if (
      code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE ||
      code === 'PLAY_SERVICES_NOT_AVAILABLE' ||
      code === '12500' ||
      msg.includes('play services')
    ) {
      throw new Error('Google Play Services is not available or needs to be updated on your device.');
    }

    // 4. Configuration error (DEVELOPER_ERROR)
    if (
      code === statusCodes?.DEVELOPER_ERROR ||
      code === 'DEVELOPER_ERROR' ||
      code === '10' ||
      msg.includes('developer_error')
    ) {
      console.error(
        '[GoogleAuth] DEVELOPER_ERROR (Code 10): Client configuration or SHA-1 fingerprint mismatch'
      );
      throw new Error('Google Sign-In configuration is still syncing with the server. Please wait a moment and try again, or continue as guest.');
    }

    // 5. Network / timeout error
    if (
      code === statusCodes?.NETWORK_ERROR ||
      code === 'NETWORK_ERROR' ||
      code === '7' ||
      msg.includes('network')
    ) {
      throw new Error('Unable to reach Google sign-in services. Please check your connection and try again.');
    }

    // Fallback friendly error
    throw new Error('Unable to complete Google Sign-In at this time. Please try again or explore as guest.');
  }
}

// Check if a username is unique across all users in Firestore
export async function checkUsernameAvailability(rawUsername: string, currentUid?: string): Promise<boolean> {
  const cleanUsername = rawUsername.trim().toLowerCase().replace(/^@/, '');
  if (!cleanUsername || cleanUsername.length < 3) return false;

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', cleanUsername), limit(2));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return true;
    }

    if (querySnapshot.size === 1 && currentUid) {
      const matchDoc = querySnapshot.docs[0];
      return matchDoc.id === currentUid;
    }

    return false;
  } catch (err) {
    console.error('[Firestore] Error checking username availability:', err);
    return true; // Fallback to allowing user progress on network glitch
  }
}

// Complete profile onboarding for newly signed in Google user
export async function completeUserProfileOnboarding(
  uid: string,
  data: {
    username: string;
    age: number;
    gender: string;
    educationLevel: EducationLevel;
  }
): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userRef);
  const existing = docSnap.exists() ? (docSnap.data() as Partial<UserProfile>) : {};

  const cleanUsername = data.username.trim().toLowerCase().replace(/^@/, '');

  const updatedProfile: UserProfile = {
    uid,
    displayName: existing.displayName || cleanUsername,
    email: existing.email || null,
    photoURL: existing.photoURL || null,
    university: existing.university || 'University Student',
    major: existing.major || 'Academic Studies',
    studyStreak: existing.studyStreak || 1,
    longestStreak: existing.longestStreak || existing.studyStreak || 1,
    createdAt: existing.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    hasCompletedOnboarding: true,
    isOnboarded: true,
    isAnonymous: false,
    username: cleanUsername,
    age: data.age,
    gender: data.gender,
    educationLevel: data.educationLevel,
    totalStudyTimeMinutes: existing.totalStudyTimeMinutes || 0,
    quizzesTaken: existing.quizzesTaken || 0,
    averageQuizScore: existing.averageQuizScore || 0,
    totalMaterialsUploaded: existing.totalMaterialsUploaded || 0,
    habitsCompleted: existing.habitsCompleted || 0,
  };

  try {
    await setDoc(userRef, updatedProfile, { merge: true });
  } catch (err) {
    console.error('[Firestore] Failed to save onboarding profile to Firestore:', err);
  }

  return updatedProfile;
}

// Guest / Demo Sign-In for instant evaluation & offline mode
export async function signInAsGuest(name: string = 'Campus Student'): Promise<UserProfile> {
  const guestUid = `guest_${Date.now()}`;
  const guestProfile: UserProfile = {
    uid: guestUid,
    displayName: name,
    email: 'guest.student@campusmind.edu',
    photoURL: null,
    university: 'Stanford / CampusMind Academy',
    major: 'Computer Science & Cognitive AI',
    studyStreak: 1,
    longestStreak: 3,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    hasCompletedOnboarding: true,
    isOnboarded: true, // Guest users skip onboarding!
    isAnonymous: true,
    username: 'student',
    educationLevel: 'Bachelors', // Default Bachelors level
    totalStudyTimeMinutes: 45,
    quizzesTaken: 2,
    averageQuizScore: 85,
    totalMaterialsUploaded: 1,
    habitsCompleted: 4,
  };

  try {
    await AsyncStorage.setItem('@campusmind_guest_user', JSON.stringify(guestProfile));
  } catch (e) {
    console.warn('Could not persist guest profile:', e);
  }

  return guestProfile;
}

// Sync Firebase User profile to Firestore
export async function syncUserProfileToFirestore(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  let existingProfile: Partial<UserProfile> = {};

  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      existingProfile = docSnap.data() as Partial<UserProfile>;
    }
  } catch (err) {
    console.warn('[Firestore] Could not fetch existing profile, creating fresh one:', err);
  }

  const isOnboarded = Boolean(existingProfile.isOnboarded || existingProfile.username);

  const profileData: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || existingProfile.displayName || (existingProfile.username ? `@${existingProfile.username}` : 'Campus Student'),
    email: user.email || existingProfile.email || null,
    photoURL: user.photoURL || existingProfile.photoURL || null,
    university: existingProfile.university || 'University Student',
    major: existingProfile.major || 'General Studies',
    studyStreak: existingProfile.studyStreak || 1,
    longestStreak: existingProfile.longestStreak || existingProfile.studyStreak || 1,
    createdAt: existingProfile.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    hasCompletedOnboarding: existingProfile.hasCompletedOnboarding ?? true,
    isOnboarded,
    isAnonymous: user.isAnonymous,
    username: existingProfile.username,
    age: existingProfile.age,
    gender: existingProfile.gender,
    educationLevel: existingProfile.educationLevel,
    totalStudyTimeMinutes: existingProfile.totalStudyTimeMinutes || 0,
    quizzesTaken: existingProfile.quizzesTaken || 0,
    averageQuizScore: existingProfile.averageQuizScore || 0,
    totalMaterialsUploaded: existingProfile.totalMaterialsUploaded || 0,
    habitsCompleted: existingProfile.habitsCompleted || 0,
  };

  try {
    await setDoc(
      userRef,
      {
        ...profileData,
        lastLoginAtServer: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Error saving user profile:', err);
  }

  return profileData;
}

// Sign out from both Firebase and Native Google Sign-In
export async function signOutUser(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (e) {
    // Ignore native sign out failure if wasn't signed in via native
  }

  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Firebase signOut error:', e);
  }

  try {
    await AsyncStorage.removeItem('@campusmind_guest_user');
  } catch (e) {
    // Ignore
  }
}
