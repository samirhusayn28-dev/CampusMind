import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncHabitsToCloud } from '../services/sync';

export interface Habit {
  id: string;
  title: string;
  icon: string;
  completedDates: string[]; // List of 'YYYY-MM-DD'
  createdAt: string;
}

export interface DayStudyStats {
  minutesStudied: number;
  lecturesCompleted: number;
}

export interface HabitState {
  habits: Habit[];
  dailyGoalMinutes: number;
  dailyGoalLectures: number;
  studyStatsByDate: Record<string, DayStudyStats>;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;

  // Actions
  toggleHabit: (habitId: string, dateKey?: string, userId?: string) => Promise<void>;
  addHabit: (title: string, icon?: string, userId?: string) => Promise<void>;
  deleteHabit: (habitId: string, userId?: string) => Promise<void>;
  logStudyMinutes: (minutes: number, userId?: string) => Promise<void>;
  logLectureCompleted: (userId?: string) => Promise<void>;
  setDailyGoalMinutes: (minutes: number, userId?: string) => Promise<void>;
  setDailyGoalLectures: (lectures: number, userId?: string) => Promise<void>;
  setHabitStateFromCloud: (cloudData: Partial<HabitState>) => void;
  resetHabits: () => void;
}

export const getTodayDateKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getYesterdayDateKey = (): string => {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DEFAULT_HABITS: Habit[] = [
  {
    id: 'habit_review',
    title: 'Review 1 lecture summary',
    icon: 'book-outline',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'habit_quiz',
    title: 'Complete active recall quiz',
    icon: 'sparkles',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'habit_time',
    title: 'Study for 20 minutes',
    icon: 'timer-outline',
    completedDates: [],
    createdAt: new Date().toISOString(),
  },
];

// Helper to recalculate streak given list of active dates
const calculateStreak = (
  activeDatesSet: Set<string>,
  prevStreak: number,
  prevLongest: number
): { currentStreak: number; longestStreak: number } => {
  const today = getTodayDateKey();
  const yesterday = getYesterdayDateKey();

  const isTodayActive = activeDatesSet.has(today);
  const isYesterdayActive = activeDatesSet.has(yesterday);

  if (!isTodayActive && !isYesterdayActive) {
    return { currentStreak: 0, longestStreak: prevLongest || 0 };
  }

  let currentStreak = 0;
  const cursor = new Date();
  if (!isTodayActive) {
    // If not studied yet today, check starting from yesterday
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;

    if (activeDatesSet.has(key)) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  if (currentStreak === 0 && (isTodayActive || isYesterdayActive)) {
    currentStreak = 1;
  }

  const longestStreak = Math.max(prevLongest || 0, currentStreak);
  return { currentStreak, longestStreak };
};

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: DEFAULT_HABITS,
      dailyGoalMinutes: 30,
      dailyGoalLectures: 2,
      studyStatsByDate: {},
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,

      toggleHabit: async (habitId, dateKey, userId) => {
        const targetDate = dateKey || getTodayDateKey();
        const state = get();

        const updatedHabits = state.habits.map((habit) => {
          if (habit.id !== habitId) return habit;
          const hasCompleted = habit.completedDates.includes(targetDate);
          const newCompleted = hasCompleted
            ? habit.completedDates.filter((d) => d !== targetDate)
            : [...habit.completedDates, targetDate];
          return { ...habit, completedDates: newCompleted };
        });

        // Collect all dates that have at least one completed habit or study activity
        const activeDatesSet = new Set<string>();
        updatedHabits.forEach((h) => {
          h.completedDates.forEach((d) => activeDatesSet.add(d));
        });
        Object.keys(state.studyStatsByDate).forEach((d) => {
          const stats = state.studyStatsByDate[d];
          if (stats.minutesStudied > 0 || stats.lecturesCompleted > 0) {
            activeDatesSet.add(d);
          }
        });

        const { currentStreak, longestStreak } = calculateStreak(
          activeDatesSet,
          state.currentStreak,
          state.longestStreak
        );

        const totalHabitsCompleted = updatedHabits.reduce(
          (acc, h) => acc + h.completedDates.length,
          0
        );

        set({
          habits: updatedHabits,
          currentStreak,
          longestStreak,
          lastActiveDate: targetDate,
        });

        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { useAuthStore } = require('./useAuthStore');
          useAuthStore.getState().updateUserProfile({ habitsCompleted: totalHabitsCompleted });
        } catch {}

        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      addHabit: async (title, icon = 'checkmark-circle-outline', userId) => {
        const id = `habit_${Date.now()}`;
        const newHabit: Habit = {
          id,
          title: title.trim(),
          icon,
          completedDates: [],
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          habits: [...state.habits, newHabit],
        }));

        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      deleteHabit: async (habitId, userId) => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== habitId),
        }));

        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      logStudyMinutes: async (minutes, userId) => {
        const today = getTodayDateKey();
        const state = get();
        const existing = state.studyStatsByDate[today] || {
          minutesStudied: 0,
          lecturesCompleted: 0,
        };

        const updatedStats = {
          ...state.studyStatsByDate,
          [today]: {
            ...existing,
            minutesStudied: existing.minutesStudied + minutes,
          },
        };

        set({ studyStatsByDate: updatedStats, lastActiveDate: today });

        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      logLectureCompleted: async (userId) => {
        const today = getTodayDateKey();
        const state = get();
        const existing = state.studyStatsByDate[today] || {
          minutesStudied: 0,
          lecturesCompleted: 0,
        };

        const updatedStats = {
          ...state.studyStatsByDate,
          [today]: {
            ...existing,
            lecturesCompleted: existing.lecturesCompleted + 1,
          },
        };

        set({ studyStatsByDate: updatedStats, lastActiveDate: today });

        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      setDailyGoalMinutes: async (minutes, userId) => {
        set({ dailyGoalMinutes: minutes });
        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      setDailyGoalLectures: async (lectures, userId) => {
        set({ dailyGoalLectures: lectures });
        if (userId) {
          syncHabitsToCloud(userId, get());
        }
      },

      setHabitStateFromCloud: (cloudData) => {
        set((state) => ({
          ...state,
          ...cloudData,
        }));
      },

      resetHabits: () => {
        set({
          habits: DEFAULT_HABITS.map((h) => ({ ...h, completedDates: [] })),
          dailyGoalMinutes: 30,
          dailyGoalLectures: 2,
          studyStatsByDate: {},
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: null,
        });
      },
    }),
    {
      name: '@campusmind_habits_v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
