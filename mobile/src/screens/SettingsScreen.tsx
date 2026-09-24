import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showThemedAlert } from '../store/useNotificationStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  useSettingsStore,
  SupportedLanguage,
  SpeechPlaybackRate,
} from '../store/useSettingsStore';
import { useContentStore } from '../store/useContentStore';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

const SPEECH_RATES: SpeechPlaybackRate[] = [0.8, 1.0, 1.25, 1.5];

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useThemeStore();
  const { user, signOut, signInWithGoogle, isLoading: isAuthLoading } = useAuthStore();
  const { setActiveMaterial, loadMaterials } = useContentStore();

  const {
    studyRemindersEnabled,
    spacedRepetitionAlerts,
    preferredLanguage,
    bilingualSummaries,
    defaultSpeechRate,
    autoGenerateQuizzes,
    hapticsEnabled,
    setStudyRemindersEnabled,
    setSpacedRepetitionAlerts,
    setPreferredLanguage,
    setBilingualSummaries,
    setDefaultSpeechRate,
    setAutoGenerateQuizzes,
    setHapticsEnabled,
  } = useSettingsStore();

  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleSignOut = () => {
    showThemedAlert(
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
      showThemedAlert('Success', 'Google Account successfully connected and synchronized!');
    } catch (err: any) {
      showThemedAlert('Google Sign-In', err.message || 'Unable to connect Google account.');
    }
  };

  const handleClearCache = async () => {
    showThemedAlert(
      'Clear Offline Cache',
      'This will remove temporarily cached materials from this device. Cloud-synced study materials will re-download when you open them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearingCache(true);
              await AsyncStorage.removeItem('@campusmind_cached_materials_v1');
              setActiveMaterial(null);
              if (user?.uid) {
                await loadMaterials(user.uid);
              }
              showThemedAlert('Cache Cleared', 'Offline study materials cache has been refreshed.');
            } catch (err: any) {
              showThemedAlert('Error', err.message || 'Could not clear cache.');
            } finally {
              setIsClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const languages: { key: SupportedLanguage; label: string }[] = [
    { key: 'en', label: 'English' },
    { key: 'roman_urdu', label: 'Roman Urdu' },
    { key: 'urdu', label: 'اردو (Urdu)' },
  ];

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
              disabled={isAuthLoading}
              activeOpacity={0.8}
            >
              {isAuthLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={16} color={colors.primary} />
                  <Text style={[styles.connectGoogleText, { color: colors.primary }]}>
                    Connect Google Account
                  </Text>
                </>
              )}
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

        {/* Study Notifications */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Study Notifications</Text>
        <Card variant="surface" style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Daily Study Reminders</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Gentle nudges to keep your study streak active
              </Text>
            </View>
            <Switch
              value={studyRemindersEnabled}
              onValueChange={setStudyRemindersEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Spaced Repetition Alerts</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Reminders when study materials are due for active recall
              </Text>
            </View>
            <Switch
              value={spacedRepetitionAlerts}
              onValueChange={setSpacedRepetitionAlerts}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>

        {/* Language & Translation */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Language & Translation</Text>
        <Card variant="surface" style={styles.settingCard}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Default AI Language
          </Text>
          <Text style={[styles.settingDesc, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Preferred language for summaries and concept explanations
          </Text>

          <View style={styles.languageOptionsRow}>
            {languages.map((lang) => {
              const isSelected = preferredLanguage === lang.key;
              return (
                <TouchableOpacity
                  key={lang.key}
                  style={[
                    styles.langPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    },
                  ]}
                  onPress={() => setPreferredLanguage(lang.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      { color: isSelected ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Bilingual Summaries</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Display English and Urdu side-by-side by default
              </Text>
            </View>
            <Switch
              value={bilingualSummaries}
              onValueChange={setBilingualSummaries}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>

        {/* AI & Audio Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>AI & Audio Preferences</Text>
        <Card variant="surface" style={styles.settingCard}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Default Speech Playback Rate
          </Text>
          <Text style={[styles.settingDesc, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Speed for text-to-speech lecture summaries
          </Text>

          <View style={styles.speechRatesRow}>
            {SPEECH_RATES.map((rate) => {
              const isSelected = defaultSpeechRate === rate;
              return (
                <TouchableOpacity
                  key={rate}
                  style={[
                    styles.ratePill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    },
                  ]}
                  onPress={() => setDefaultSpeechRate(rate)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.ratePillText,
                      { color: isSelected ? colors.onPrimary : colors.textPrimary },
                    ]}
                  >
                    {rate}x
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Auto-Generate Quizzes</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Formulate active recall questions upon lecture ingestion
              </Text>
            </View>
            <Switch
              value={autoGenerateQuizzes}
              onValueChange={setAutoGenerateQuizzes}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Haptic Feedback</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Tactile responses on button taps and quiz answers
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>

        {/* Data & Storage Actions */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Data & Storage</Text>
        <Card variant="surface" style={styles.settingCard}>
          <TouchableOpacity
            style={styles.settingActionRow}
            onPress={handleClearCache}
            disabled={isClearingCache}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Clear Offline Cache</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Free up device storage; notes will re-sync from cloud
              </Text>
            </View>
            {isClearingCache ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
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
  settingActionRow: {
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
  languageOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  langPill: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  langPillText: {
    ...typography.presets.labelMedium,
    fontWeight: '600',
  },
  speechRatesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratePill: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratePillText: {
    ...typography.presets.labelMedium,
    fontWeight: '700',
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
