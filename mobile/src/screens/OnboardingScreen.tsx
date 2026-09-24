import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { showThemedAlert } from '../store/useNotificationStore';
import { triggerHaptic } from '../services/haptics';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = spacing.lg;
const SLIDE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

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
      'Ask any question and receive accurate, cited answers strictly grounded in your actual course slides and textbooks — never generic hallucinations.',
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
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInAsGuest, isLoading, clearError } = useAuthStore();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= slides.length) return;
    scrollRef.current?.scrollTo({ x: index * SLIDE_WIDTH, animated: true });
    setCurrentSlideIndex(index);
  };

  const handleNext = () => {
    triggerHaptic('lightImpact');
    if (currentSlideIndex < slides.length - 1) {
      scrollToIndex(currentSlideIndex + 1);
    }
  };

  const handleSkip = () => {
    triggerHaptic('lightImpact');
    scrollToIndex(slides.length - 1);
  };

  const handleSlideTap = () => {
    // Tap-to-continue: advance to next slide if not on last
    if (currentSlideIndex < slides.length - 1) {
      triggerHaptic('lightImpact');
      scrollToIndex(currentSlideIndex + 1);
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SLIDE_WIDTH);
    if (newIndex !== currentSlideIndex && newIndex >= 0 && newIndex < slides.length) {
      setCurrentSlideIndex(newIndex);
      triggerHaptic('selection');
    }
  };

  const handleDotPress = (index: number) => {
    triggerHaptic('selection');
    scrollToIndex(index);
  };

  const handleGoogleSignIn = async () => {
    try {
      triggerHaptic('mediumImpact');
      await signInWithGoogle();
      triggerHaptic('successNotification');
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert(
        'Google Sign-In',
        err.message || 'Google Sign-In failed. Please check your internet connection and try again.',
        [{ text: 'OK', onPress: clearError }]
      );
    }
  };

  const handleGuestSignIn = async () => {
    try {
      triggerHaptic('lightImpact');
      await signInAsGuest('Campus Student');
      triggerHaptic('successNotification');
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert('Demo Sign-In', err.message || 'Unable to sign in as guest.');
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, spacing.md),
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
      ]}
    >
      {/* Top Branding Section: StudioXenos Logo & CampusMind */}
      <View style={styles.topHeader}>
        <View style={styles.brandingBlock}>
          <Image
            source={require('../../assets/studioxenos-logo.png')}
            style={styles.studioLogo}
            resizeMode="contain"
          />
          <Text style={[styles.studioCaption, { color: colors.textSecondary }]}>
            Designed & Developed By StudioXenos
          </Text>
        </View>

        {currentSlideIndex < slides.length - 1 ? (
          <TouchableOpacity
            onPress={handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.skipButton}
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* CampusMind Title Row */}
      <View style={styles.brandRow}>
        <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>CampusMind</Text>
      </View>

      {/* Horizontal Paging Swipeable Slides */}
      <View style={styles.scrollWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          decelerationRate="fast"
          snapToInterval={SLIDE_WIDTH}
          snapToAlignment="center"
          contentContainerStyle={styles.scrollContent}
        >
          {slides.map((slide) => (
            <TouchableOpacity
              key={slide.id}
              activeOpacity={0.95}
              onPress={handleSlideTap}
              style={[styles.slideSlideWrapper, { width: SLIDE_WIDTH }]}
            >
              <Card variant="surface" style={styles.heroCard}>
                {/* Icon Circle */}
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: getSlideIconBg(slide.iconColorVariant) },
                  ]}
                >
                  <Ionicons
                    name={slide.icon}
                    size={52}
                    color={getSlideIconColor(slide.iconColorVariant)}
                  />
                </View>

                {/* Badge */}
                <Badge
                  label={slide.badge}
                  variant={slide.badgeVariant}
                  style={styles.badge}
                />

                {/* Title & Description */}
                <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>
                  {slide.title}
                </Text>
                <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>
                  {slide.description}
                </Text>
              </Card>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Pagination Dots */}
      <View style={styles.paginationRow}>
        {slides.map((_, index) => {
          const isActive = index === currentSlideIndex;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDotPress(index)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
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

      {/* Action Controls */}
      <View style={styles.actionsContainer}>
        {currentSlideIndex < slides.length - 1 ? (
          /* Slide 0 & 1: Explicit Next Button */
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
        ) : (
          /* Final Slide: Get Started / Sign In Options */
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons
                    name="logo-google"
                    size={20}
                    color={colors.onPrimary}
                    style={styles.btnIcon}
                  />
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    Get Started with Google
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
                Explore with Demo Student Account
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    justifyContent: 'space-between',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  brandingBlock: {
    alignItems: 'flex-start',
    gap: 3,
  },
  studioLogo: {
    width: 36,
    height: 36,
  },
  studioCaption: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  skipText: {
    ...typography.presets.labelMedium,
    fontWeight: '600',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginVertical: spacing.xs,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
  },
  brandTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scrollWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
  },
  slideSlideWrapper: {
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  heroCard: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderRadius: borderRadius.xxl,
  },
  iconCircle: {
    width: 104,
    height: 104,
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
    marginBottom: spacing.sm,
    lineHeight: 28,
  },
  slideDescription: {
    ...typography.presets.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xs,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginVertical: spacing.md,
  },
  dot: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  actionsContainer: {
    gap: spacing.sm,
    width: '100%',
    paddingBottom: spacing.xs,
  },
  primaryButton: {
    height: 52,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    ...shadows.card,
  },
  primaryButtonText: {
    ...typography.presets.labelLarge,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnIcon: {
    marginRight: spacing.sm,
  },
  guestButton: {
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    ...typography.presets.labelMedium,
    fontWeight: '600',
  },
});
