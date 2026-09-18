export * from './colors';
export * from './typography';
export * from './spacing';

import { lightColors, darkColors, ThemeColors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

export interface Theme {
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  isDark: boolean;
}

export const getTheme = (isDark: boolean): Theme => ({
  colors: isDark ? darkColors : lightColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  isDark,
});
