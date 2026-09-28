import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { borderRadius, shadows, spacing } from '../theme/spacing';
import { AnimatedPressable } from '../theme/animations';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'elevated' | 'subtle' | 'sage' | 'peach' | 'lavender' | 'sky';
  noPadding?: boolean;
  onPress?: () => void;
  activeOpacity?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'surface',
  noPadding = false,
  onPress,
  activeOpacity = 0.9,
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

  const cardStyle = [
    styles.card,
    {
      backgroundColor: getBackgroundColor(),
      borderColor: getBorderColor(),
      padding: noPadding ? 0 : spacing.lg,
    },
    variant === 'elevated' && shadows.floating,
    variant === 'surface' && shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        scaleTarget={0.98}
        activeOpacity={activeOpacity}
        style={cardStyle}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
