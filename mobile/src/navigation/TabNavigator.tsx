import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { StudyChatScreen } from '../screens/StudyChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useThemeStore } from '../store/useThemeStore';
import { triggerHaptic } from '../services/haptics';
import { borderRadius, spacing, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

import { AnimatedPressable, IOS_EASING } from '../theme/animations';
import { Animated } from 'react-native';

const TabIconView: React.FC<{
  focused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  activeColor: string;
  indicatorColor: string;
}> = ({ focused, iconName, color, activeColor, indicatorColor }) => {
  const scale = React.useRef(new Animated.Value(focused ? 1 : 0.95)).current;
  const opacity = React.useRef(new Animated.Value(focused ? 1 : 0.75)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: focused ? 1 : 0.95,
        duration: 180,
        easing: IOS_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.75,
        duration: 180,
        easing: IOS_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        focused && { backgroundColor: indicatorColor },
        { transform: [{ scale }], opacity },
      ]}
    >
      <Ionicons
        name={iconName}
        size={22}
        color={focused ? activeColor : color}
      />
    </Animated.View>
  );
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator: React.FC = () => {
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10);
  const tabHeight = 58 + bottomPadding;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade',
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: tabHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          ...shadows.card,
        },
        tabBarLabelStyle: {
          ...typography.presets.labelMedium,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarItemStyle: {
          overflow: 'hidden',
        },
        // iOS-style subtle scale press feedback
        tabBarButton: (props) => {
          const { ref, ...rest } = props as any;
          return (
            <AnimatedPressable
              {...rest}
              scaleTarget={0.94}
              activeOpacity={0.82}
              onPress={(e: any) => {
                triggerHaptic('lightImpact');
                props.onPress?.(e);
              }}
              style={props.style}
            />
          );
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-circle-outline';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'StudyChat') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return (
            <TabIconView
              focused={focused}
              iconName={iconName}
              color={color}
              activeColor={colors.primary}
              indicatorColor={colors.tabBarIndicator}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{ tabBarLabel: 'Library' }}
      />
      <Tab.Screen
        name="StudyChat"
        component={StudyChatScreen}
        options={{ tabBarLabel: 'Study Chat' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 52,
    height: 30,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
