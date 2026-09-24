import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Animated, Image, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemedNotificationHost } from './src/components/ThemedNotificationHost';
import { useThemeStore } from './src/store/useThemeStore';
import { useAuthStore } from './src/store/useAuthStore';
import { initializeNotifications } from './src/services/notifications';

// Prevent the native splash screen from auto-hiding while resources and auth are loading
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const { colors, isDark } = useThemeStore();
  const isLoading = useAuthStore((state) => state.isLoading);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Dismiss native splash screen
      SplashScreen.hideAsync().catch(() => {});

      // Gentle fade out transition to app UI
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => {
        setSplashAnimationDone(true);
      });
    }
  }, [isLoading, fadeAnim]);

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RootNavigator />
        <ThemedNotificationHost />

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
            <View style={styles.splashCenterContent}>
              <Image
                source={
                  isDark
                    ? require('./assets/splash-icon-dark.png')
                    : require('./assets/splash-icon.png')
                }
                style={styles.splashImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.splashBrandFooter}>
              <Image
                source={require('./assets/studioxenos-logo.png')}
                style={styles.splashBrandLogo}
                resizeMode="contain"
              />
              <Text style={[styles.splashBrandCaption, { color: isDark ? '#A0A49E' : '#737871' }]}>
                Designed & Developed By StudioXenos
              </Text>
            </View>
          </Animated.View>
        )}
      </View>
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
  splashCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: 140,
    height: 140,
  },
  splashBrandFooter: {
    alignItems: 'center',
    gap: 6,
  },
  splashBrandLogo: {
    width: 32,
    height: 32,
  },
  splashBrandCaption: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
