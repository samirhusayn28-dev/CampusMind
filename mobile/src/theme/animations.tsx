import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  AccessibilityInfo,
  Platform,
} from 'react-native';

// iOS-like physics & easing curve: cubic-bezier(0.32, 0.72, 0, 1)
export const IOS_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export const ANIMATION_DURATION = {
  instant: 120,
  fast: 180,
  normal: 250,
  smooth: 320,
};

// Global reduce motion hook
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReducedMotion(enabled))
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReducedMotion(enabled)
    );

    return () => {
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}

interface AnimatedPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTarget?: number; // Default 0.97
  activeOpacity?: number; // Default 0.88
  useScale?: boolean;
  children?: React.ReactNode;
}

/**
 * Apple/iOS-style subtle pressable component with gentle scale-down & spring recovery.
 * Animates strictly transform and opacity with useNativeDriver: true.
 */
export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  style,
  scaleTarget = 0.97,
  activeOpacity = 0.88,
  useScale = true,
  disabled,
  children,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const reducedMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    if (disabled) return;

    if (!reducedMotion && useScale) {
      Animated.timing(scaleAnim, {
        toValue: scaleTarget,
        duration: ANIMATION_DURATION.instant,
        easing: IOS_EASING,
        useNativeDriver: true,
      }).start();
    }

    Animated.timing(opacityAnim, {
      toValue: activeOpacity,
      duration: ANIMATION_DURATION.instant,
      easing: IOS_EASING,
      useNativeDriver: true,
    }).start();

    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    if (disabled) return;

    if (!reducedMotion && useScale) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION.fast,
        easing: IOS_EASING,
        useNativeDriver: true,
      }).start();
    }

    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: ANIMATION_DURATION.fast,
      easing: IOS_EASING,
      useNativeDriver: true,
    }).start();

    onPressOut?.(event);
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
};

interface FadeSlideViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  slideDistance?: number; // Default 10px
  duration?: number; // Default 250ms
  delay?: number; // Stagger delay in ms
}

/**
 * iOS-style subtle fade-in with a micro 8-10px upward slide.
 * Strictly animates opacity and translateY with useNativeDriver: true.
 */
export const FadeSlideView: React.FC<FadeSlideViewProps> = ({
  children,
  style,
  slideDistance = 10,
  duration = ANIMATION_DURATION.normal,
  delay = 0,
}) => {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : slideDistance)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: IOS_EASING,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: IOS_EASING,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, duration, reducedMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

interface StaggeredListItemProps {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxStaggerCount?: number;
  stepMs?: number;
}

/**
 * Wraps list cards with a soft staggered fade-in (35ms between items, capped at first 8 items).
 */
export const StaggeredListItem: React.FC<StaggeredListItemProps> = ({
  index,
  children,
  style,
  maxStaggerCount = 8,
  stepMs = 35,
}) => {
  const cappedIndex = Math.min(index, maxStaggerCount);
  const delay = cappedIndex * stepMs;

  return (
    <FadeSlideView style={style} delay={delay} slideDistance={8}>
      {children}
    </FadeSlideView>
  );
};
