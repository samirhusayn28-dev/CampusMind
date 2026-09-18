import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore - getReactNativePersistence is available in react-native entry
import { initializeAuth, getReactNativePersistence, getAuth, GoogleAuthProvider, signInWithCredential, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { UserProfile } from '../types/auth';

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

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage Persistence
let authInstance: any;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);

// Client IDs for Native Google Sign-In
export const GOOGLE_CONFIG = {
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '220472508393-0kviptkk3bo3a8sv9qi19qluiuj4pq7q.apps.googleusercontent.com',
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    '220472508393-m63rfu8n1ul1l613u1i7oblae4n3moav.apps.googleusercontent.com',
};

// Configure GoogleSignin once at startup
let isGoogleSigninConfigured = false;
export function configureGoogleSignIn(): void {
  if (isGoogleSigninConfigured) return;
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
      throw new Error('Google Sign-In succeeded but no ID Token was returned');
    }

    // Exchange Google ID Token with Firebase
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;

    // Sync user data to Firestore
    const profile = await syncUserProfileToFirestore(firebaseUser);
    return profile;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sign in was cancelled');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign in is already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is not available or outdated');
    }
    console.error('[GoogleAuth] Native sign-in error:', error);
    throw error;
  }
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
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    hasCompletedOnboarding: true,
    isAnonymous: true,
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

  const profileData: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || existingProfile.displayName || 'Campus Learner',
    email: user.email || existingProfile.email || null,
    photoURL: user.photoURL || existingProfile.photoURL || null,
    university: existingProfile.university || 'University Student',
    major: existingProfile.major || 'General Studies',
    studyStreak: existingProfile.studyStreak || 1,
    createdAt: existingProfile.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    hasCompletedOnboarding: existingProfile.hasCompletedOnboarding ?? true,
    isAnonymous: user.isAnonymous,
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
