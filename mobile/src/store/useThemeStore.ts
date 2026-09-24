import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { ThemeColors, lightColors, darkColors } from '../theme/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const getIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return mode === 'dark';
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'light',
      isDark: false,
      colors: lightColors,

      setThemeMode: (mode: ThemeMode) => {
        const isDark = getIsDark(mode);
        set({
          themeMode: mode,
          isDark,
          colors: isDark ? darkColors : lightColors,
        });
      },

      toggleTheme: () => {
        const nextIsDark = !get().isDark;
        set({
          themeMode: nextIsDark ? 'dark' : 'light',
          isDark: nextIsDark,
          colors: nextIsDark ? darkColors : lightColors,
        });
      },
    }),
    {
      name: '@campusmind_theme_v1',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = getIsDark(state.themeMode);
          state.isDark = isDark;
          state.colors = isDark ? darkColors : lightColors;
        }
      },
    }
  )
);
