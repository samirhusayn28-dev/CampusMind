import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useThemeStore();
  const { user, signOut, signInWithGoogle, isLoading } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of CampusMind?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleConnectGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      Alert.alert('Google Sign-In', err.message || 'Unable to connect Google account.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Settings"
        subtitle="Preferences and study profile"
        showThemeToggle={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card variant="surface" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="person" size={26} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                {user?.displayName || 'Campus Learner'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                {user?.email || 'guest.student@campusmind.edu'}
              </Text>
            </View>
            <Badge
              label={user?.isAnonymous ? 'Demo Mode' : 'Connected'}
              variant={user?.isAnonymous ? 'peach' : 'sage'}
            />
          </View>

          {user?.isAnonymous && (
            <TouchableOpacity
              style={[styles.connectGoogleBtn, { backgroundColor: colors.primaryContainer }]}
              onPress={handleConnectGoogle}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={16} color={colors.primary} />
              <Text style={[styles.connectGoogleText, { color: colors.primary }]}>
                Connect Google Account (Native)
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Appearance Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Appearance</Text>
        <Card variant="surface" style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Warm Dark Mode</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Cozy deep charcoal palette for night study
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>

        {/* Study Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>AI & Audio Preferences</Text>
        <Card variant="surface" style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Bilingual Translation</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Roman Urdu & Urdu summaries
              </Text>
            </View>
            <Badge label="Ready" variant="peach" />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Summary Speech Rate</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Default playback speed (1.0x)
              </Text>
            </View>
            <Badge label="1.0x" variant="sky" />
          </View>
        </Card>

        {/* Account Actions */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account</Text>
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: colors.surfaceSubtle }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.peach} />
          <Text style={[styles.signOutText, { color: colors.peach }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* About App */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
        <Card variant="lavender" style={styles.aboutCard}>
          <View style={styles.aboutHeader}>
            <Ionicons name="school" size={24} color={colors.lavender} />
            <Text style={[styles.aboutTitle, { color: colors.textPrimary }]}>CampusMind v1.0.0</Text>
          </View>
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            AI Study Companion designed with Material You principles. Built with React Native, Expo, Firebase Auth with Native Google Play Services, Groq AI, and Pinecone RAG.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.massive,
    gap: spacing.md,
  },
  profileCard: {
    padding: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.presets.titleMedium,
  },
  profileEmail: {
    ...typography.presets.bodySmall,
    marginTop: 2,
  },
  connectGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  connectGoogleText: {
    ...typography.presets.labelMedium,
  },
  sectionTitle: {
    ...typography.presets.titleSmall,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  settingCard: {
    padding: spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.presets.labelLarge,
  },
  settingDesc: {
    ...typography.presets.caption,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.card,
  },
  signOutText: {
    ...typography.presets.labelLarge,
    fontWeight: '600',
  },
  aboutCard: {
    padding: spacing.lg,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  aboutTitle: {
    ...typography.presets.titleMedium,
  },
  aboutText: {
    ...typography.presets.bodySmall,
    lineHeight: 20,
  },
});
