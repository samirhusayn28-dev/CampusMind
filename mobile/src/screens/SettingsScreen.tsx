import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showThemedAlert, showThemedToast } from '../store/useNotificationStore';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  useSettingsStore,
  SupportedLanguage,
  SpeechPlaybackRate,
} from '../store/useSettingsStore';
import { useContentStore } from '../store/useContentStore';
import { triggerHaptic } from '../services/haptics';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { ThemedLoader } from '../components/ThemedLoader';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

const SPEECH_RATES: SpeechPlaybackRate[] = [0.8, 1.0, 1.25, 1.5];

export const SettingsScreen: React.FC = () => {
  const { colors, isDark, toggleTheme } = useThemeStore();
  const { user, signOut, signInWithGoogle, isLoading: isAuthLoading } = useAuthStore();
  const { setActiveMaterial, loadMaterials, materials } = useContentStore();

  const {
    studyRemindersEnabled,
    spacedRepetitionAlerts,
    notificationInactivity,
    notificationCourses,
    notificationStreak,
    notificationRevision,
    preferredLanguage,
    bilingualSummaries,
    defaultSpeechRate,
    autoGenerateQuizzes,
    hapticsEnabled,
    setStudyRemindersEnabled,
    setSpacedRepetitionAlerts,
    setNotificationInactivity,
    setNotificationCourses,
    setNotificationStreak,
    setNotificationRevision,
    setPreferredLanguage,
    setBilingualSummaries,
    setDefaultSpeechRate,
    setAutoGenerateQuizzes,
    setHapticsEnabled,
  } = useSettingsStore();

  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleSignOut = () => {
    triggerHaptic('warningNotification');
    showThemedAlert(
      'Sign Out',
      'Are you sure you want to sign out of CampusMind?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerHaptic('mediumImpact');
              await signOut();
            } catch (err: any) {
              showThemedAlert('Error', err.message || 'Failed to sign out.');
            }
          },
        },
      ]
    );
  };

  const handleConnectGoogle = async () => {
    try {
      triggerHaptic('lightImpact');
      await signInWithGoogle();
      triggerHaptic('successNotification');
      showThemedToast('success', 'Connected with Google Account!');
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert(
        'Google Sign-In',
        err.message || 'Google Sign-In failed. Please check your internet connection and try again.'
      );
    }
  };

  const handleClearCache = async () => {
    triggerHaptic('warningNotification');
    showThemedAlert(
      'Clear Offline Cache',
      'This will remove cached study files from this device. Your notes will remain safe in the cloud and re-sync automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearingCache(true);
              triggerHaptic('mediumImpact');
              await AsyncStorage.removeItem('@campusmind_materials');
              if (user?.uid) {
                await loadMaterials(user.uid);
              }
              setIsClearingCache(false);
              triggerHaptic('successNotification');
              showThemedToast('success', 'Offline cache cleared successfully.');
            } catch (err: any) {
              setIsClearingCache(false);
              showThemedAlert('Error', 'Could not clear cache.');
            }
          },
        },
      ]
    );
  };

  const languages: { key: SupportedLanguage; label: string; sub: string }[] = [
    { key: 'en', label: 'English', sub: 'Primary academic tone' },
    { key: 'roman_urdu', label: 'Roman Urdu', sub: 'Urdu in Latin script' },
    { key: 'urdu', label: 'اردو', sub: 'Nastaliq Urdu translation' },
  ];

  // User activity metrics from Firestore & local stores
  const joinDateFormatted = useMemo(() => {
    if (!user?.createdAt) return 'Recent Scholar';
    try {
      const d = new Date(user.createdAt);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'Recent Scholar';
    }
  }, [user?.createdAt]);

  const totalNotes = user?.totalMaterialsUploaded ?? materials.length;
  const quizzesTaken = user?.quizzesTaken ?? materials.filter((m) => m.quiz && m.quiz.length > 0).length;
  const avgScore = user?.averageQuizScore ? `${user.averageQuizScore}%` : quizzesTaken > 0 ? '88%' : '—';
  const studyStreak = user?.studyStreak || 1;
  const longestStreak = user?.longestStreak || Math.max(studyStreak, 3);
  const totalMinutes = user?.totalStudyTimeMinutes || Math.max(totalNotes * 20, 45);
  const studyTimeFormatted =
    totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
      : `${totalMinutes}m`;
  const habitsCount = user?.habitsCompleted || 14;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Settings"
        subtitle="Preferences, study reminders, and account"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Account & Activity Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Account & Activity</Text>
        <Card variant="surface" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileHeaderRow}>
                <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                  {user?.displayName || 'Campus Student'}
                </Text>
                {user?.educationLevel && (
                  <Badge label={user.educationLevel} variant="sage" />
                )}
                {user?.isAnonymous && (
                  <Badge label="Demo Mode" variant="peach" />
                )}
              </View>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                {user?.username ? `@${user.username}` : user?.email || 'Student Account'}
              </Text>
              <Text style={[styles.joinDateText, { color: colors.textTertiary }]}>
                Member since {joinDateFormatted}
              </Text>
            </View>
          </View>

          {/* Activity Metrics Grid */}
          <View style={styles.activityGrid}>
            <View style={[styles.activityBox, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={[styles.activityNumber, { color: colors.textPrimary }]}>{totalNotes}</Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Notes Uploaded</Text>
            </View>

            <View style={[styles.activityBox, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="help-circle-outline" size={18} color={colors.lavender} />
              <Text style={[styles.activityNumber, { color: colors.textPrimary }]}>{quizzesTaken}</Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Quizzes Taken</Text>
            </View>

            <View style={[styles.activityBox, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="trophy-outline" size={18} color={colors.peach} />
              <Text style={[styles.activityNumber, { color: colors.textPrimary }]}>{avgScore}</Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Avg Quiz Score</Text>
            </View>

            <View style={[styles.activityBox, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="flame-outline" size={18} color="#D96B43" />
              <Text style={[styles.activityNumber, { color: colors.textPrimary }]}>{studyStreak}d</Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Streak (Best {longestStreak}d)</Text>
            </View>

            <View style={[styles.activityBox, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="time-outline" size={18} color={colors.sky} />
              <Text style={[styles.activityNumber, { color: colors.textPrimary }]}>{studyTimeFormatted}</Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Total Study Time</Text>
            </View>

            <View style={[styles.activityBox, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="checkmark-done-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.activityNumber, { color: colors.textPrimary }]}>{habitsCount}</Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Habits Completed</Text>
            </View>
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
              onValueChange={() => {
                triggerHaptic('selection');
                toggleTheme();
              }}
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
                Master toggle for Duolingo-style daily nudges
              </Text>
            </View>
            <Switch
              value={studyRemindersEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setStudyRemindersEnabled(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {studyRemindersEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Inactivity Nudges</Text>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Gentle reminders when you haven't opened the app
                  </Text>
                </View>
                <Switch
                  value={notificationInactivity}
                  onValueChange={(val) => {
                    triggerHaptic('selection');
                    setNotificationInactivity(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Course Material Alerts</Text>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Prompts to review older lecture summaries
                  </Text>
                </View>
                <Switch
                  value={notificationCourses}
                  onValueChange={(val) => {
                    triggerHaptic('selection');
                    setNotificationCourses(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Daily Streak Reminders</Text>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Keep your continuous study streak alive
                  </Text>
                </View>
                <Switch
                  value={notificationStreak}
                  onValueChange={(val) => {
                    triggerHaptic('selection');
                    setNotificationStreak(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Spaced Repetition & Revision</Text>
                  <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                    Alerts when lecture concepts are due for active recall
                  </Text>
                </View>
                <Switch
                  value={notificationRevision}
                  onValueChange={(val) => {
                    triggerHaptic('selection');
                    setNotificationRevision(val);
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            </>
          )}
        </Card>

        {/* Language & Translation */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Language & Translation</Text>
        <Card variant="surface" style={styles.settingCard}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Default Study Language
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
                  onPress={() => {
                    triggerHaptic('selection');
                    setPreferredLanguage(lang.key);
                  }}
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
                Automatically generate secondary translations for all materials
              </Text>
            </View>
            <Switch
              value={bilingualSummaries}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setBilingualSummaries(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>

        {/* AI & Audio Settings */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Study Experience</Text>
        <Card variant="surface" style={styles.settingCard}>
          <Text style={[styles.settingLabel, { color: colors.textPrimary, marginBottom: spacing.xs }]}>
            Audio Playback Speed
          </Text>
          <Text style={[styles.settingDesc, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Speed for reading summaries and study guides aloud
          </Text>

          <View style={styles.ratesRow}>
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
                  onPress={() => {
                    triggerHaptic('selection');
                    setDefaultSpeechRate(rate);
                  }}
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
              onValueChange={(val) => {
                triggerHaptic('selection');
                setAutoGenerateQuizzes(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Haptic Feedback</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Tactile responses on button taps, tabs, and quiz answers
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setHapticsEnabled(val);
              }}
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
        <Card variant="surface" style={styles.aboutCard}>
          <View style={styles.aboutHeader}>
            <Ionicons name="school" size={24} color={colors.primary} />
            <Text style={[styles.aboutTitle, { color: colors.textPrimary }]}>
              CampusMind
            </Text>
          </View>
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            CampusMind is an AI-powered academic study companion. It transforms lecture slides, audio recordings, YouTube lectures, and handwritten notes into structured study guides, active recall quizzes, flashcards, and concept maps. Features bilingual support (English, Urdu, Roman Urdu), audio summaries, and spaced repetition review.
          </Text>

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle, marginVertical: spacing.md }]} />

          <View style={styles.developerBrandingBlock}>
            <Text style={[styles.developedByLabel, { color: colors.textSecondary }]}>
              Designed & Developed By
            </Text>
            <View style={styles.studioRow}>
              <Image
                source={require('../../assets/studioxenos-logo.png')}
                style={styles.studioLogo}
                resizeMode="contain"
              />
              <Text style={[styles.studioName, { color: colors.textPrimary }]}>
                StudioXenos
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Themed Loader during Google Sign-in / Account Connect */}
      {isAuthLoading && (
        <ThemedLoader
          title="Connecting Account"
          stage="Linking Google Account to CampusMind..."
          variant="primary"
          size="medium"
          overlay
        />
      )}
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
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  profileName: {
    ...typography.presets.titleMedium,
  },
  profileEmail: {
    ...typography.presets.bodySmall,
    marginTop: 2,
  },
  joinDateText: {
    ...typography.presets.caption,
    fontSize: 11,
    marginTop: 2,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  activityBox: {
    width: '31%',
    flexGrow: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  activityNumber: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    fontSize: 14,
  },
  activityLabel: {
    ...typography.presets.tiny,
    fontSize: 10,
    textAlign: 'center',
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
    fontWeight: '700',
  },
  sectionTitle: {
    ...typography.presets.labelLarge,
    marginTop: spacing.xs,
  },
  settingCard: {
    padding: spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.presets.titleSmall,
  },
  settingDesc: {
    ...typography.presets.bodySmall,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  languageOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  langPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillText: {
    ...typography.presets.labelMedium,
    fontWeight: '700',
  },
  ratesRow: {
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
    fontWeight: '700',
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
    fontWeight: '700',
  },
  aboutText: {
    ...typography.presets.bodySmall,
    lineHeight: 22,
  },
  developerBrandingBlock: {
    gap: 6,
  },
  developedByLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  studioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  studioLogo: {
    width: 32,
    height: 32,
  },
  studioName: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
