import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useNetworkStore } from '../store/useNetworkStore';
import { triggerHaptic } from '../services/haptics';
import { FadeSlideView, AnimatedPressable } from '../theme/animations';
import { typography } from '../theme/typography';
import { borderRadius, spacing, shadows } from '../theme/spacing';

interface NoInternetScreenProps {
  onRetry?: () => Promise<void> | void;
}

export const NoInternetScreen: React.FC<NoInternetScreenProps> = ({ onRetry }) => {
  const { colors, isDark } = useThemeStore();
  const checkConnection = useNetworkStore((state) => state.checkConnection);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    triggerHaptic('mediumImpact');
    setIsRetrying(true);
    try {
      const isOnline = await checkConnection();
      if (isOnline && onRetry) {
        await onRetry();
      }
    } catch {
      // Ignored: network store remains offline
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <FadeSlideView style={styles.contentCard} slideDistance={12} duration={280}>
        {/* Offline Icon Circle */}
        <View style={[styles.iconCircle, { backgroundColor: colors.peachContainer }]}>
          <Ionicons name="cloud-offline-outline" size={38} color={colors.peach} />
        </View>

        {/* Message */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          No Internet Connection
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Please check your internet connection and try again.
        </Text>

        {/* Retry Button */}
        <AnimatedPressable
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={handleRetry}
          disabled={isRetrying}
          scaleTarget={0.96}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="reload" size={18} color={colors.onPrimary} style={styles.buttonIcon} />
              <Text style={[styles.retryButtonText, { color: colors.onPrimary }]}>
                Retry Connection
              </Text>
            </View>
          )}
        </AnimatedPressable>
      </FadeSlideView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  contentCard: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.presets.headline,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.presets.bodyMedium,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  retryButton: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 190,
    ...shadows.card,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.labelLarge,
    fontSize: 15,
  },
});
