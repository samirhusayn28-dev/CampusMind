import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { useSettingsStore, SettingsState } from '../store/useSettingsStore';

const CLOUD_SETTINGS_KEY = '@campusmind_settings_v1';

// 1. Sync settings to Firestore
export async function syncSettingsToCloud(userId: string, settings: Partial<SettingsState>): Promise<void> {
  if (!userId || userId.startsWith('guest_')) return;

  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    const {
      studyRemindersEnabled,
      reminderTime,
      spacedRepetitionAlerts,
      preferredLanguage,
      bilingualSummaries,
      defaultSpeechRate,
      autoGenerateQuizzes,
      hapticsEnabled,
    } = settings;

    await setDoc(
      settingsRef,
      {
        studyRemindersEnabled,
        reminderTime,
        spacedRepetitionAlerts,
        preferredLanguage,
        bilingualSummaries,
        defaultSpeechRate,
        autoGenerateQuizzes,
        hapticsEnabled,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Sync] Could not sync settings to Firestore (offline cache active):', err);
  }
}

// 2. Load cloud settings on login and merge with local store
export async function loadCloudSettings(userId: string): Promise<void> {
  if (!userId || userId.startsWith('guest_')) return;

  try {
    const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const store = useSettingsStore.getState();

      if (data.studyRemindersEnabled !== undefined) store.setStudyRemindersEnabled(data.studyRemindersEnabled);
      if (data.reminderTime !== undefined) store.setReminderTime(data.reminderTime);
      if (data.spacedRepetitionAlerts !== undefined) store.setSpacedRepetitionAlerts(data.spacedRepetitionAlerts);
      if (data.preferredLanguage !== undefined) store.setPreferredLanguage(data.preferredLanguage);
      if (data.bilingualSummaries !== undefined) store.setBilingualSummaries(data.bilingualSummaries);
      if (data.defaultSpeechRate !== undefined) store.setDefaultSpeechRate(data.defaultSpeechRate);
      if (data.autoGenerateQuizzes !== undefined) store.setAutoGenerateQuizzes(data.autoGenerateQuizzes);
      if (data.hapticsEnabled !== undefined) store.setHapticsEnabled(data.hapticsEnabled);
    }
  } catch (err) {
    console.warn('[Sync] Could not load cloud settings, using local cache:', err);
  }
}

// 3. Sync habits & streak data to Firestore
export async function syncHabitsToCloud(userId: string, habitState: any): Promise<void> {
  if (!userId || userId.startsWith('guest_')) return;

  try {
    const habitsRef = doc(db, 'users', userId, 'habits', 'data');
    const {
      habits,
      dailyGoalMinutes,
      dailyGoalLectures,
      studyStatsByDate,
      currentStreak,
      longestStreak,
      lastActiveDate,
    } = habitState;

    await setDoc(
      habitsRef,
      {
        habits: habits || [],
        dailyGoalMinutes: dailyGoalMinutes || 30,
        dailyGoalLectures: dailyGoalLectures || 2,
        studyStatsByDate: studyStatsByDate || {},
        currentStreak: currentStreak ?? 0,
        longestStreak: longestStreak ?? 0,
        lastActiveDate: lastActiveDate || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Sync] Could not sync habits to Firestore (offline cache active):', err);
  }
}

// 4. Load cloud habits and merge with local store
export async function loadCloudHabits(userId: string, applyHabitState: (data: any) => void): Promise<void> {
  if (!userId || userId.startsWith('guest_')) return;

  try {
    const habitsRef = doc(db, 'users', userId, 'habits', 'data');
    const docSnap = await getDoc(habitsRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      applyHabitState({
        habits: data.habits || [],
        dailyGoalMinutes: data.dailyGoalMinutes || 30,
        dailyGoalLectures: data.dailyGoalLectures || 2,
        studyStatsByDate: data.studyStatsByDate || {},
        currentStreak: data.currentStreak ?? 0,
        longestStreak: data.longestStreak ?? 0,
        lastActiveDate: data.lastActiveDate || null,
      });
    }
  } catch (err) {
    console.warn('[Sync] Could not load cloud habits, using local cache:', err);
  }
}
