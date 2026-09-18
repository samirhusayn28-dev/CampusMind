import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { borderRadius, shadows, spacing } from '../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'elevated' | 'subtle' | 'sage' | 'peach' | 'lavender' | 'sky';
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'surface',
  noPadding = false,
}) => {
  const colors = useThemeStore((state) => state.colors);

  const getBackgroundColor = () => {
    switch (variant) {
      case 'elevated':
        return colors.surfaceElevated;
      case 'subtle':
        return colors.surfaceSubtle;
      case 'sage':
        return colors.primaryContainer;
      case 'peach':
        return colors.peachContainer;
      case 'lavender':
        return colors.lavenderContainer;
      case 'sky':
        return colors.skyContainer;
      case 'surface':
      default:
        return colors.surface;
    }
  };

  const getBorderColor = () => {
    if (variant === 'sage' || variant === 'peach' || variant === 'lavender' || variant === 'sky') {
      return 'transparent';
    }
    return colors.borderSubtle;
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          padding: noPadding ? 0 : spacing.lg,
        },
        variant === 'elevated' && shadows.floating,
        variant === 'surface' && shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
