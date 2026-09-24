import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { showThemedAlert } from '../store/useNotificationStore';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

export const AuthScreen: React.FC = () => {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInAsGuest, isLoading, error, clearError } = useAuthStore();

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      showThemedAlert(
        'Google Sign-In',
        err.message || 'Unable to complete Google Sign-In at this moment.',
        [{ text: 'OK', onPress: clearError }]
      );
    }
  };

  const handleGuestSignIn = async () => {
    try {
      await signInAsGuest('Campus Student');
    } catch (err: any) {
      showThemedAlert('Demo Sign-In', err.message || 'Unable to sign in as guest.');
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, spacing.xl),
          paddingBottom: Math.max(insets.bottom, spacing.xl),
        },
      ]}
    >
      <View style={styles.content}>
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="school" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>CampusMind</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to access your synchronized notes, summaries, and quizzes.
          </Text>
        </View>

        {/* Auth Action Card */}
        <Card variant="surface" style={styles.authCard}>
          <Badge label="Firebase Auth + Google Play Services" variant="sage" style={styles.badge} />
          
          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: colors.primary }]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="logo-google" size={20} color={colors.onPrimary} style={styles.btnIcon} />
                <Text style={[styles.googleButtonText, { color: colors.onPrimary }]}>
                  Sign in with Google
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.guestButton, { backgroundColor: colors.surfaceSubtle }]}
            onPress={handleGuestSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.guestButtonText, { color: colors.textPrimary }]}>
              Continue as Demo Student
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Security / Privacy Footnote */}
        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textTertiary} />
          <Text style={[styles.footnoteText, { color: colors.textTertiary }]}>
            All AI operations and document parsing run on secure serverless functions. Your API keys are never stored on device.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.presets.headline,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.presets.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  authCard: {
    padding: spacing.xl,
    gap: spacing.md,
    borderRadius: borderRadius.xxl,
  },
  badge: {
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  googleButton: {
    height: 52,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnIcon: {
    marginRight: spacing.sm,
  },
  googleButtonText: {
    ...typography.presets.labelLarge,
    fontSize: 15,
  },
  guestButton: {
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    ...typography.presets.labelMedium,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  footnoteText: {
    ...typography.presets.tiny,
    flex: 1,
    lineHeight: 14,
  },
});
