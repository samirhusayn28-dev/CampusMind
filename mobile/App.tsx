import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Animated, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemedNotificationHost } from './src/components/ThemedNotificationHost';
import { useThemeStore } from './src/store/useThemeStore';
import { useAuthStore } from './src/store/useAuthStore';

// Prevent the native splash screen from auto-hiding while resources and auth are loading
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const { colors, isDark } = useThemeStore();
  const isLoading = useAuthStore((state) => state.isLoading);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

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
            <Image
              source={
                isDark
                  ? require('./assets/splash-icon-dark.png')
                  : require('./assets/splash-icon.png')
              }
              style={styles.splashImage}
              resizeMode="contain"
            />
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
    justifyContent: 'center',
    zIndex: 99999,
  },
  splashImage: {
    width: 140,
    height: 140,
  },
});
