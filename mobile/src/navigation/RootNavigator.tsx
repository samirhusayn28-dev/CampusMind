import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
 import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './types';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ContentSummaryScreen } from '../screens/ContentSummaryScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { ConceptMapScreen } from '../screens/ConceptMapScreen';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { typography } from '../theme/typography';
import { borderRadius, spacing } from '../theme/spacing';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { colors, isDark } = useThemeStore();
  const { isAuthenticated, hasCompletedOnboarding, isLoading, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.borderSubtle,
      primary: colors.primary,
    },
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primaryContainer }]}>
          <Text style={{ fontSize: 32 }}>🎓</Text>
        </View>
        <Text style={[styles.loadingTitle, { color: colors.textPrimary }]}>CampusMind</Text>
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 280,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        {!hasCompletedOnboarding ? (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ animation: 'fade', animationDuration: 250 }}
          />
        ) : !isAuthenticated ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ animation: 'fade', animationDuration: 250 }}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={TabNavigator}
              options={{ animation: 'fade', animationDuration: 250 }}
            />
            <Stack.Screen
              name="Summary"
              options={{
                animation: 'slide_from_right',
                animationDuration: 280,
                gestureEnabled: true,
              }}
              component={({ navigation, route }: any) => (
                <ContentSummaryScreen
                  materialId={route.params?.materialId}
                  onBack={() => navigation.goBack()}
                  onNavigateToChat={() => navigation.navigate('MainTabs', { screen: 'StudyChat' })}
                  onNavigateToQuiz={() =>
                    navigation.navigate('Quiz', { materialId: route.params?.materialId })
                  }
                  onNavigateToConceptMap={() =>
                    navigation.navigate('ConceptMap', { materialId: route.params?.materialId })
                  }
                />
              )}
            />
            <Stack.Screen
              name="Quiz"
              options={{
                animation: 'slide_from_bottom',
                animationDuration: 300,
                presentation: 'modal',
                gestureEnabled: true,
              }}
              component={({ navigation, route }: any) => (
                <QuizScreen
                  materialId={route.params?.materialId}
                  onBack={() => navigation.goBack()}
                  onNavigateToSummary={() =>
                    navigation.navigate('Summary', { materialId: route.params?.materialId })
                  }
                />
              )}
            />
            <Stack.Screen
              name="ConceptMap"
              options={{
                animation: 'slide_from_right',
                animationDuration: 280,
                gestureEnabled: true,
              }}
              component={({ navigation, route }: any) => (
                <ConceptMapScreen
                  materialId={route.params?.materialId}
                  onBack={() => navigation.goBack()}
                  onNavigateToChat={() => navigation.navigate('MainTabs', { screen: 'StudyChat' })}
                />
              )}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  loadingTitle: {
    ...typography.presets.headline,
    fontSize: 22,
    marginBottom: spacing.md,
  },
  spinner: {
    marginTop: spacing.xs,
  },
});
