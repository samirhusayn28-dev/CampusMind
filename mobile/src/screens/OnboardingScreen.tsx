import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

const { width } = Dimensions.get('window');

interface Slide {
  id: string;
  badge: string;
  badgeVariant: 'sage' | 'peach' | 'sky';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColorVariant: 'sage' | 'peach' | 'sky';
}

const slides: Slide[] = [
  {
    id: '1',
    badge: 'Multi-Format Ingestion',
    badgeVariant: 'sage',
    title: 'All Your Lectures, Beautifully Simplified',
    description:
      'Transform complex lecture PDFs, YouTube video links, live audio recordings, and handwritten notebook photos into structured, bite-sized study guides.',
    icon: 'document-text-outline',
    iconColorVariant: 'sage',
  },
  {
    id: '2',
    badge: 'Grounded Study Chat',
    badgeVariant: 'peach',
    title: 'Chat Directly With Your Course Notes',
    description:
      'Ask any question and receive accurate, cited answers strictly grounded in your actual professor’s slides and textbooks — never generic hallucinations.',
    icon: 'chatbubble-ellipses-outline',
    iconColorVariant: 'peach',
  },
  {
    id: '3',
    badge: 'Active Recall & Audio',
    badgeVariant: 'sky',
    title: 'Practice Quizzes & Audio Summaries',
    description:
      'Test your comprehension with auto-generated practice quizzes, listen to summaries aloud while walking, and retain knowledge with spaced repetition.',
    icon: 'headset-outline',
    iconColorVariant: 'sky',
  },
];

export const OnboardingScreen: React.FC = () => {
  const { colors } = useThemeStore();
  const { signInWithGoogle, signInAsGuest, isLoading, error, clearError } = useAuthStore();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const currentSlide = slides[currentSlideIndex];

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert(
        'Google Sign-In',
        err.message || 'Unable to complete Google Sign-In at this time. You can try the Demo mode below.',
        [{ text: 'OK', onPress: clearError }]
      );
    }
  };

  const handleGuestSignIn = async () => {
    try {
      await signInAsGuest('Campus Student');
    } catch (err: any) {
      Alert.alert('Demo Sign-In', err.message || 'Unable to sign in as guest.');
    }
  };

  const getSlideIconBg = (variant: 'sage' | 'peach' | 'sky') => {
    switch (variant) {
      case 'peach':
        return colors.peachContainer;
      case 'sky':
        return colors.skyContainer;
      case 'sage':
      default:
        return colors.primaryContainer;
    }
  };

  const getSlideIconColor = (variant: 'sage' | 'peach' | 'sky') => {
    switch (variant) {
      case 'peach':
        return colors.peach;
      case 'sky':
        return colors.sky;
      case 'sage':
      default:
        return colors.primary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header & Skip */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>CampusMind</Text>
        </View>

        {currentSlideIndex < slides.length - 1 && (
          <TouchableOpacity
            onPress={() => setCurrentSlideIndex(slides.length - 1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Slide Card */}
      <View style={styles.slideContainer}>
        <Card variant="surface" style={styles.heroCard}>
          {/* Icon Circle */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: getSlideIconBg(currentSlide.iconColorVariant) },
            ]}
          >
            <Ionicons
              name={currentSlide.icon}
              size={56}
              color={getSlideIconColor(currentSlide.iconColorVariant)}
            />
          </View>

          {/* Slide Badge */}
          <Badge
            label={currentSlide.badge}
            variant={currentSlide.badgeVariant}
            style={styles.badge}
          />

          {/* Slide Title & Description */}
          <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>
            {currentSlide.title}
          </Text>
          <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>
            {currentSlide.description}
          </Text>
        </Card>
      </View>

      {/* Pagination Dots */}
      <View style={styles.paginationRow}>
        {slides.map((_, index) => {
          const isActive = index === currentSlideIndex;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => setCurrentSlideIndex(index)}
              style={[
                styles.dot,
                {
                  width: isActive ? 28 : 8,
                  backgroundColor: isActive ? colors.primary : colors.border,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Google Sign-In Pill Button */}
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: colors.primary }]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="logo-google" size={20} color={colors.onPrimary} style={styles.btnIcon} />
              <Text style={[styles.googleButtonText, { color: colors.onPrimary }]}>
                Continue with Google
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Demo / Guest Sign-In */}
        <TouchableOpacity
          style={[styles.guestButton, { backgroundColor: colors.surfaceSubtle }]}
          onPress={handleGuestSignIn}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={[styles.guestButtonText, { color: colors.textPrimary }]}>
            Explore with Demo Student Account
          </Text>
        </TouchableOpacity>

        {/* Next Slide Arrow (if not on last slide) */}
        {currentSlideIndex < slides.length - 1 && (
          <TouchableOpacity
            style={styles.nextTextRow}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text style={[styles.nextText, { color: colors.textSecondary }]}>Swipe or Tap Next</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingBottom: 36,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
  },
  brandTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
  },
  skipText: {
    ...typography.presets.labelMedium,
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  heroCard: {
    padding: spacing.xl,
    alignItems: 'center',
    textAlign: 'center',
    borderRadius: borderRadius.xxl,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    marginBottom: spacing.md,
  },
  slideTitle: {
    ...typography.presets.headline,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  slideDescription: {
    ...typography.presets.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  actionsContainer: {
    gap: spacing.md,
  },
  googleButton: {
    height: 54,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  nextTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
  },
  nextText: {
    ...typography.presets.caption,
  },
});
