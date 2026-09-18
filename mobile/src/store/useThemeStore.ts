import { create } from 'zustand';
import { Appearance } from 'react-native';
import { ThemeColors, lightColors, darkColors } from '../theme/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'dark';
  }
  return mode === 'dark';
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'light',
  isDark: false,
  colors: lightColors,

  setThemeMode: (mode: ThemeMode) => {
    const isDark = getInitialIsDark(mode);
    set({
      themeMode: mode,
      isDark,
      colors: isDark ? darkColors : lightColors,
    });
  },

  toggleTheme: () => {
    const currentIsDark = get().isDark;
    const nextIsDark = !currentIsDark;
    set({
      themeMode: nextIsDark ? 'dark' : 'light',
      isDark: nextIsDark,
      colors: nextIsDark ? darkColors : lightColors,
    });
  },
}));
