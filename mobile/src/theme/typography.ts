import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif-rounded',
  default: 'System',
});

export const typography = {
  // Font Family Stacks
  fontFamily: {
    regular: fontFamily,
    medium: fontFamily,
    semiBold: fontFamily,
    bold: fontFamily,
  },

  // Font Sizes & Scales
  sizes: {
    display: 32,
    headline: 24,
    titleLarge: 20,
    titleMedium: 18,
    bodyLarge: 16,
    bodyMedium: 14,
    bodySmall: 13,
    caption: 12,
    tiny: 10,
  },

  // Line Heights
  lineHeights: {
    display: 40,
    headline: 32,
    titleLarge: 26,
    titleMedium: 24,
    bodyLarge: 24,
    bodyMedium: 20,
    bodySmall: 18,
    caption: 16,
    tiny: 14,
  },

  // Standard Presets
  presets: {
    display: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '700',
      letterSpacing: -0.5,
    } as TextStyle,

    headline: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '700',
      letterSpacing: -0.3,
    } as TextStyle,

    titleLarge: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '600',
      letterSpacing: -0.2,
    } as TextStyle,

    titleMedium: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600',
      letterSpacing: -0.1,
    } as TextStyle,

    titleSmall: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      letterSpacing: -0.1,
    } as TextStyle,

    bodyLarge: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
    } as TextStyle,

    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
    } as TextStyle,

    bodySmall: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
    } as TextStyle,

    labelLarge: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      letterSpacing: 0.1,
    } as TextStyle,

    labelMedium: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: 0.2,
    } as TextStyle,

    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '400',
    } as TextStyle,

    tiny: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '400',
    } as TextStyle,
  },
};
