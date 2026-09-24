import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../services/firebase';
import { syncSettingsToCloud } from '../services/sync';

export type SupportedLanguage = 'en' | 'roman_urdu' | 'urdu';
export type SpeechPlaybackRate = 0.8 | 1.0 | 1.25 | 1.5;

export interface SettingsState {
  // Study & Notifications
  studyRemindersEnabled: boolean;
  reminderTime: string; // e.g. "20:00"
  spacedRepetitionAlerts: boolean;
  notificationInactivity: boolean;
  notificationCourses: boolean;
  notificationStreak: boolean;
  notificationRevision: boolean;

  // Language & Translation
  preferredLanguage: SupportedLanguage;
  bilingualSummaries: boolean;

  // AI & Audio
  defaultSpeechRate: SpeechPlaybackRate;
  autoGenerateQuizzes: boolean;

  // Haptics & UI
  hapticsEnabled: boolean;

  // Setters
  setStudyRemindersEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  setSpacedRepetitionAlerts: (enabled: boolean) => void;
  setNotificationInactivity: (enabled: boolean) => void;
  setNotificationCourses: (enabled: boolean) => void;
  setNotificationStreak: (enabled: boolean) => void;
  setNotificationRevision: (enabled: boolean) => void;
  setPreferredLanguage: (lang: SupportedLanguage) => void;
  setBilingualSummaries: (enabled: boolean) => void;
  setDefaultSpeechRate: (rate: SpeechPlaybackRate) => void;
  setAutoGenerateQuizzes: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const defaultValues = {
  studyRemindersEnabled: true,
  reminderTime: '20:00',
  spacedRepetitionAlerts: true,
  notificationInactivity: true,
  notificationCourses: true,
  notificationStreak: true,
  notificationRevision: true,
  preferredLanguage: 'en' as SupportedLanguage,
  bilingualSummaries: false,
  defaultSpeechRate: 1.0 as SpeechPlaybackRate,
  autoGenerateQuizzes: true,
  hapticsEnabled: true,
};

const syncIfSignedIn = (patch: Partial<SettingsState>, getState: () => SettingsState) => {
  const uid = auth.currentUser?.uid;
  if (uid && !auth.currentUser?.isAnonymous) {
    syncSettingsToCloud(uid, { ...getState(), ...patch });
  }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultValues,

      setStudyRemindersEnabled: (enabled) => {
        set({ studyRemindersEnabled: enabled });
        syncIfSignedIn({ studyRemindersEnabled: enabled }, get);
      },
      setReminderTime: (time) => {
        set({ reminderTime: time });
        syncIfSignedIn({ reminderTime: time }, get);
      },
      setSpacedRepetitionAlerts: (enabled) => {
        set({ spacedRepetitionAlerts: enabled });
        syncIfSignedIn({ spacedRepetitionAlerts: enabled }, get);
      },
      setNotificationInactivity: (enabled) => {
        set({ notificationInactivity: enabled });
        syncIfSignedIn({ notificationInactivity: enabled }, get);
      },
      setNotificationCourses: (enabled) => {
        set({ notificationCourses: enabled });
        syncIfSignedIn({ notificationCourses: enabled }, get);
      },
      setNotificationStreak: (enabled) => {
        set({ notificationStreak: enabled });
        syncIfSignedIn({ notificationStreak: enabled }, get);
      },
      setNotificationRevision: (enabled) => {
        set({ notificationRevision: enabled });
        syncIfSignedIn({ notificationRevision: enabled }, get);
      },
      setPreferredLanguage: (lang) => {
        set({ preferredLanguage: lang });
        syncIfSignedIn({ preferredLanguage: lang }, get);
      },
      setBilingualSummaries: (enabled) => {
        set({ bilingualSummaries: enabled });
        syncIfSignedIn({ bilingualSummaries: enabled }, get);
      },
      setDefaultSpeechRate: (rate) => {
        set({ defaultSpeechRate: rate });
        syncIfSignedIn({ defaultSpeechRate: rate }, get);
      },
      setAutoGenerateQuizzes: (enabled) => {
        set({ autoGenerateQuizzes: enabled });
        syncIfSignedIn({ autoGenerateQuizzes: enabled }, get);
      },
      setHapticsEnabled: (enabled) => {
        set({ hapticsEnabled: enabled });
        syncIfSignedIn({ hapticsEnabled: enabled }, get);
      },
      resetToDefaults: () => {
        set({ ...defaultValues });
        syncIfSignedIn(defaultValues, get);
      },
    }),
    {
      name: '@campusmind_settings_v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
