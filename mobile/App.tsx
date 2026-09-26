import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Animated, Image, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemedNotificationHost } from './src/components/ThemedNotificationHost';
import { InAppUpdateModal } from './src/components/InAppUpdateModal';
import { ThemedLoader } from './src/components/ThemedLoader';
import { useThemeStore } from './src/store/useThemeStore';
import { useAuthStore } from './src/store/useAuthStore';
import { initializeNotifications, rescheduleAllReminders } from './src/services/notifications';

// Prevent the native splash screen from auto-hiding while resources and auth are loading
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const { colors, isDark } = useThemeStore();
  const isLoading = useAuthStore((state) => state.isLoading);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeNotifications()
      .then((granted) => {
        if (granted) {
          rescheduleAllReminders().catch(() => {});
        }
      })
      .catch((err) => console.warn('[App] Notification init error:', err));
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Dismiss native splash screen
      SplashScreen.hideAsync().catch(() => {});

      // Snappy fade out transition to app UI
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSplashAnimationDone(true);
      });
    }
  }, [isLoading, fadeAnim]);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <RootNavigator />
          <ThemedNotificationHost />
          <InAppUpdateModal />

        {!splashAnimationDone && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.splashOverlay,
              {
                backgroundColor: isDark ? '#161816' : '#FBF9F5',
                opacity: fadeAnim,
              },
            ]}
          >
            <View style={styles.splashTopCredit}>
              <Image
                source={require('./assets/studioxenos-logo.png')}
                style={styles.splashBrandLogo}
                resizeMode="contain"
              />
              <Text style={[styles.splashBrandCaption, { color: isDark ? '#A0A49E' : '#737871' }]}>
                Designed & Developed By StudioXenos
              </Text>
            </View>

            <View style={styles.splashCenterContent}>
              <ThemedLoader
                title="CampusMind"
                subtext="Your calm, daily study companion"
                variant="primary"
                size="large"
              />
            </View>

            <View style={styles.splashSpacer} />
          </Animated.View>
        )}
        </View>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splashOverlay: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
    zIndex: 99999,
  },
  splashTopCredit: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
  },
  splashCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashSpacer: {
    height: 40,
  },
  splashBrandLogo: {
    width: 28,
    height: 28,
  },
  splashBrandCaption: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
