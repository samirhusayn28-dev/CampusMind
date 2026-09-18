import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { borderRadius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface BadgeProps {
  label: string;
  variant?: 'sage' | 'peach' | 'lavender' | 'sky' | 'amber' | 'subtle';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'sage',
  style,
  textStyle,
  icon,
}) => {
  const colors = useThemeStore((state) => state.colors);

  const getVariantStyles = () => {
    switch (variant) {
      case 'peach':
        return {
          bg: colors.peachContainer,
          text: colors.peach,
        };
      case 'lavender':
        return {
          bg: colors.lavenderContainer,
          text: colors.lavender,
        };
      case 'sky':
        return {
          bg: colors.skyContainer,
          text: colors.sky,
        };
      case 'amber':
        return {
          bg: colors.amberContainer,
          text: colors.amber,
        };
      case 'subtle':
        return {
          bg: colors.surfaceSubtle,
          text: colors.textSecondary,
        };
      case 'sage':
      default:
        return {
          bg: colors.primaryContainer,
          text: colors.primary,
        };
    }
  };

  const { bg, text } = getVariantStyles();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.text, { color: text }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  text: {
    ...typography.presets.labelMedium,
  },
});
