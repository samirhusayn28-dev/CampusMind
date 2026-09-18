import { ViewStyle } from 'react-native';

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  giant: 40,
  massive: 48,
};

export const borderRadius = {
  none: 0,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,      // Standard Material You Card corner
  card: 24,    // Cozy card radius
  xxl: 28,     // Large Dialog / Feature Card radius
  full: 9999,  // Pill buttons / Floating Chips
};

export const shadows = {
  card: {
    shadowColor: '#25201A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,

  floating: {
    shadowColor: '#25201A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  } as ViewStyle,

  subtle: {
    shadowColor: '#25201A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  } as ViewStyle,
};
