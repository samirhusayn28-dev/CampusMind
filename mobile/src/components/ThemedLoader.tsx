import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { typography, spacing, borderRadius } from '../theme';

export interface ThemedLoaderProps {
  /** Optional headline */
  title?: string;
  /** Current static stage or message */
  stage?: string;
  /** List of dynamic status stages to cycle through smoothly */
  stages?: string[];
  /** Secondary subtext / footnote */
  subtext?: string;
  /** Centered icon name from Ionicons */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accent tone color variant */
  variant?: 'primary' | 'peach' | 'sky' | 'lavender';
  /** Size variant */
  size?: 'mini' | 'small' | 'medium' | 'large';
  /** Whether to fill screen/container with centered overlay */
  overlay?: boolean;
  style?: ViewStyle;
}

export const ThemedLoader: React.FC<ThemedLoaderProps> = ({
  title,
  stage,
  stages,
  subtext,
  icon = 'sparkles',
  variant = 'primary',
  size = 'medium',
  overlay = false,
  style,
}) => {
  const colors = useThemeStore((state) => state.colors);
  const isDark = useThemeStore((state) => state.isDark);

  // Pick color accent based on variant
  const getAccentColor = () => {
    switch (variant) {
      case 'peach':
        return {
          main: colors.peach,
          container: colors.peachContainer,
          border: isDark ? 'rgba(235, 148, 112, 0.4)' : 'rgba(217, 119, 87, 0.25)',
        };
      case 'sky':
        return {
          main: colors.sky,
          container: colors.skyContainer,
          border: isDark ? 'rgba(125, 185, 232, 0.4)' : 'rgba(74, 144, 217, 0.25)',
        };
      case 'lavender':
        return {
          main: colors.lavender,
          container: colors.lavenderContainer,
          border: isDark ? 'rgba(186, 163, 235, 0.4)' : 'rgba(138, 110, 201, 0.25)',
        };
      case 'primary':
      default:
        return {
          main: colors.primary,
          container: colors.primaryContainer,
          border: isDark ? 'rgba(122, 170, 130, 0.4)' : 'rgba(76, 122, 84, 0.25)',
        };
    }
  };

  const accent = getAccentColor();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const haloOpacity = useRef(new Animated.Value(0.4)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const reverseRotateAnim = useRef(new Animated.Value(0)).current;

  // Stages text cycler
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const textFadeAnim = useRef(new Animated.Value(1)).current;

  // Orbit and Pulse Animations (Snappy ~2x accelerated cycles)
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.14,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.18,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.94,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(haloOpacity, {
            toValue: 0.55,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const orbitLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const reverseOrbitLoop = Animated.loop(
      Animated.timing(reverseRotateAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    orbitLoop.start();
    reverseOrbitLoop.start();

    return () => {
      pulseLoop.stop();
      orbitLoop.stop();
      reverseOrbitLoop.stop();
    };
  }, [pulseAnim, haloOpacity, rotateAnim, reverseRotateAnim]);

  // Stage text cycling effect (Snappy 1.25s cadence with 150ms crossfade)
  useEffect(() => {
    if (!stages || stages.length <= 1) return;

    const interval = setInterval(() => {
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStageIdx((prev) => (prev + 1) % stages.length);
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }, 1250);

    return () => clearInterval(interval);
  }, [stages, textFadeAnim]);

  // Interpolated rotation values
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const reverseSpin = reverseRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  // Dimensions based on size prop
  const getDims = () => {
    switch (size) {
      case 'mini':
        return { outer: 26, inner: 18, icon: 11, orbitDot: 3, border: 1.5 };
      case 'small':
        return { outer: 52, inner: 38, icon: 20, orbitDot: 5, border: 2 };
      case 'large':
        return { outer: 124, inner: 86, icon: 42, orbitDot: 9, border: 2.5 };
      case 'medium':
      default:
        return { outer: 92, inner: 64, icon: 30, orbitDot: 7, border: 2 };
    }
  };

  const dims = getDims();

  const activeStageText = stages && stages.length > 0
    ? stages[currentStageIdx]
    : stage;

  // Mini inline representation (e.g. inside small button or compact pill)
  if (size === 'mini') {
    return (
      <View style={[styles.miniContainer, style]}>
        <Animated.View
          style={[
            styles.miniOrbit,
            {
              width: dims.outer,
              height: dims.outer,
              borderRadius: dims.outer / 2,
              borderColor: accent.border,
              borderTopColor: accent.main,
              borderWidth: dims.border,
              transform: [{ rotate: spin }],
            },
          ]}
        />
      </View>
    );
  }

  const content = (
    <View style={[styles.centerWrapper, style]}>
      {/* Visual Animation Circle */}
      <View style={[styles.animationContainer, { width: dims.outer, height: dims.outer }]}>
        {/* Outer Pulsing Halo */}
        <Animated.View
          style={[
            styles.halo,
            {
              width: dims.outer,
              height: dims.outer,
              borderRadius: dims.outer / 2,
              backgroundColor: accent.main,
              opacity: haloOpacity,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Orbit Ring 1 (Clockwise with satellite bead) */}
        <Animated.View
          style={[
            styles.orbitRing,
            {
              width: dims.outer,
              height: dims.outer,
              borderRadius: dims.outer / 2,
              borderColor: accent.border,
              borderWidth: dims.border,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <View
            style={[
              styles.satelliteDot,
              {
                width: dims.orbitDot,
                height: dims.orbitDot,
                borderRadius: dims.orbitDot / 2,
                backgroundColor: accent.main,
                top: -dims.orbitDot / 2,
                left: dims.outer / 2 - dims.orbitDot / 2,
              },
            ]}
          />
        </Animated.View>

        {/* Orbit Ring 2 (Counter-Clockwise subtle dashed arc) */}
        <Animated.View
          style={[
            styles.orbitRingInner,
            {
              width: dims.outer - 12,
              height: dims.outer - 12,
              borderRadius: (dims.outer - 12) / 2,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderTopColor: accent.main,
              borderWidth: 1.5,
              transform: [{ rotate: reverseSpin }],
            },
          ]}
        />

        {/* Center Glow Core & Icon */}
        <Animated.View
          style={[
            styles.coreCircle,
            {
              width: dims.inner,
              height: dims.inner,
              borderRadius: dims.inner / 2,
              backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
              borderColor: accent.border,
              borderWidth: 1.5,
              shadowColor: accent.main,
            },
          ]}
        >
          <Ionicons name={icon} size={dims.icon} color={accent.main} />
        </Animated.View>
      </View>

      {/* Dynamic Status Text & Stage Progression */}
      {(title || activeStageText || subtext) && (
        <View style={styles.textContainer}>
          {title ? (
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          ) : null}

          {activeStageText ? (
            <Animated.Text
              style={[
                styles.stageText,
                {
                  color: isDark ? colors.textPrimary : accent.main,
                  opacity: textFadeAnim,
                },
              ]}
            >
              {activeStageText}
            </Animated.Text>
          ) : null}

          {subtext ? (
            <Text style={[styles.subtext, { color: colors.textSecondary }]}>
              {subtext}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (overlay) {
    return (
      <View
        style={[
          styles.overlayContainer,
          {
            backgroundColor: isDark
              ? 'rgba(18, 20, 18, 0.88)'
              : 'rgba(251, 249, 245, 0.92)',
          },
        ]}
      >
        {content}
      </View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  centerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: spacing.xl,
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  halo: {
    position: 'absolute',
  },
  orbitRing: {
    position: 'absolute',
    borderStyle: 'solid',
  },
  orbitRingInner: {
    position: 'absolute',
    borderStyle: 'solid',
  },
  satelliteDot: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  coreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  miniContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniOrbit: {
    borderStyle: 'solid',
  },
  textContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    maxWidth: 320,
  },
  title: {
    ...typography.presets.titleLarge,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stageText: {
    ...typography.presets.bodyMedium,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  subtext: {
    ...typography.presets.caption,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.xxs,
  },
});
