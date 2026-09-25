import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { EducationLevel } from '../types/auth';
import { checkUsernameAvailability } from '../services/firebase';
import { triggerHaptic } from '../services/haptics';
import { showThemedAlert, showThemedToast } from '../store/useNotificationStore';
import { Card } from '../components/Card';
import { ThemedLoader } from '../components/ThemedLoader';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

const EDUCATION_LEVELS: {
  level: EducationLevel;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    level: 'Intermediate',
    title: 'Intermediate',
    subtitle: 'High School / FSc / A-Levels (Simpler explanations & foundational terms)',
    icon: 'school-outline',
  },
  {
    level: 'Bachelors',
    title: 'Bachelors',
    subtitle: 'Undergraduate (Standard university rigor & analytical reasoning)',
    icon: 'book-outline',
  },
  {
    level: 'Masters',
    title: 'Masters',
    subtitle: 'Graduate (Advanced domain concepts & technical depth)',
    icon: 'ribbon-outline',
  },
  {
    level: 'PhD',
    title: 'PhD',
    subtitle: 'Doctorate / Research (Dense theoretical synthesis & scholarly depth)',
    icon: 'medal-outline',
  },
];

const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const AGE_PRESETS = [18, 19, 20, 21, 22, 23, 24];

export const ProfileOnboardingScreen: React.FC = () => {
  const { colors, isDark } = useThemeStore();
  const { user, completeProfileOnboarding, isLoading } = useAuthStore();

  // Initial username from email or display name
  const defaultUsername = useMemo(() => {
    if (user?.username) return user.username;
    if (user?.email) {
      const handle = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
      return handle.slice(0, 15);
    }
    if (user?.displayName) {
      const handle = user.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
      return handle.slice(0, 15);
    }
    return '';
  }, [user]);

  // Form State
  const [username, setUsername] = useState(defaultUsername);
  const [age, setAge] = useState<number>(20);
  const [customAgeInput, setCustomAgeInput] = useState('20');
  const [gender, setGender] = useState('Prefer not to say');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('Bachelors');

  // Username validation & debounce state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const debounceTimer = useRef<any>(null);

  // Validate and check username availability
  useEffect(() => {
    const clean = username.trim().toLowerCase().replace(/^@/, '');

    if (!clean) {
      setIsCheckingUsername(false);
      setIsUsernameAvailable(null);
      setUsernameError('Please enter a unique username');
      return;
    }

    if (clean.length < 3) {
      setIsCheckingUsername(false);
      setIsUsernameAvailable(false);
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(clean)) {
      setIsCheckingUsername(false);
      setIsUsernameAvailable(false);
      setUsernameError('Only lowercase letters, numbers, and underscores allowed');
      return;
    }

    if (clean.length > 20) {
      setIsCheckingUsername(false);
      setIsUsernameAvailable(false);
      setUsernameError('Username cannot exceed 20 characters');
      return;
    }

    setUsernameError(null);
    setIsCheckingUsername(true);
    setIsUsernameAvailable(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(clean, user?.uid);
        setIsCheckingUsername(false);
        setIsUsernameAvailable(available);
        if (!available) {
          setUsernameError('Username already taken. Please pick another.');
        } else {
          setUsernameError(null);
        }
      } catch (err) {
        setIsCheckingUsername(false);
        setIsUsernameAvailable(true);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [username, user?.uid]);

  const handleAgePreset = (selectedAge: number) => {
    triggerHaptic('selection');
    setAge(selectedAge);
    setCustomAgeInput(String(selectedAge));
  };

  const handleCustomAgeChange = (text: string) => {
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    setCustomAgeInput(text);
    if (!isNaN(num) && num >= 10 && num <= 99) {
      setAge(num);
    }
  };

  const handleSubmit = async () => {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');

    if (!cleanUsername || cleanUsername.length < 3 || isUsernameAvailable === false) {
      triggerHaptic('errorNotification');
      showThemedAlert('Invalid Username', usernameError || 'Please choose an available username.');
      return;
    }

    if (!age || age < 12 || age > 99) {
      triggerHaptic('errorNotification');
      showThemedAlert('Invalid Age', 'Please provide a valid age between 12 and 99.');
      return;
    }

    try {
      triggerHaptic('mediumImpact');
      await completeProfileOnboarding({
        username: cleanUsername,
        age,
        gender,
        educationLevel,
      });
      triggerHaptic('successNotification');
      showThemedToast('success', `Welcome, @${cleanUsername}! Profile set up successfully.`);
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert('Profile Error', err.message || 'Could not save profile setup.');
    }
  };

  const isFormValid =
    Boolean(username.trim()) &&
    username.trim().length >= 3 &&
    isUsernameAvailable === true &&
    !isCheckingUsername &&
    age >= 12;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* StudioXenos Branding */}
          <View style={styles.topBranding}>
            <Image
              source={require('../../assets/studioxenos-logo.png')}
              style={styles.studioLogo}
              resizeMode="contain"
            />
            <Text style={[styles.studioCaption, { color: colors.textSecondary }]}>
              Designed & Developed By StudioXenos
            </Text>
          </View>

          {/* Welcome Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome to CampusMind</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Create your unique study profile. Your education level personalizes AI study guides and quizzes.
            </Text>
          </View>

          {/* 1. Username Field */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Choose Username (Unique)
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.surface,
                  borderColor: usernameError
                    ? '#D96B43'
                    : isUsernameAvailable
                    ? colors.primary
                    : colors.borderSubtle,
                },
              ]}
            >
              <Text style={[styles.atPrefix, { color: colors.primary }]}>@</Text>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: colors.textPrimary }]}
              />
              <View style={styles.inputStatusIcon}>
                {isCheckingUsername ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : isUsernameAvailable === true ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : usernameError ? (
                  <Ionicons name="alert-circle" size={20} color="#D96B43" />
                ) : null}
              </View>
            </View>

            {/* Helper / Status message */}
            {isCheckingUsername ? (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                Checking availability in Firestore...
              </Text>
            ) : isUsernameAvailable === true ? (
              <Text style={[styles.helperText, { color: colors.primary, fontWeight: '600' }]}>
                ✓ @{username.trim()} is available
              </Text>
            ) : usernameError ? (
              <Text style={[styles.helperText, { color: '#D96B43', fontWeight: '500' }]}>
                {usernameError}
              </Text>
            ) : (
              <Text style={[styles.helperText, { color: colors.textTertiary }]}>
                3-20 letters, numbers, or underscores (like Instagram)
              </Text>
            )}
          </View>

          {/* 2. Education Level (Key Context for AI Summaries & Quizzes) */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Education Level (AI Study Difficulty)
            </Text>
            <Text style={[styles.fieldSubLabel, { color: colors.textSecondary }]}>
              Adjusts vocabulary, concept density, and quiz complexity automatically.
            </Text>

            <View style={styles.educationList}>
              {EDUCATION_LEVELS.map((item) => {
                const isSelected = educationLevel === item.level;
                return (
                  <TouchableOpacity
                    key={item.level}
                    activeOpacity={0.8}
                    onPress={() => {
                      triggerHaptic('selection');
                      setEducationLevel(item.level);
                    }}
                  >
                    <Card
                      variant="surface"
                      style={[
                        styles.educationCard,
                        isSelected && {
                          borderColor: colors.primary,
                          borderWidth: 2,
                          backgroundColor: colors.primaryContainer,
                        },
                      ]}
                    >
                      <View style={styles.educationCardHeader}>
                        <View
                          style={[
                            styles.educationIconCircle,
                            {
                              backgroundColor: isSelected
                                ? colors.surface
                                : colors.surfaceSubtle,
                            },
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={20}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.educationTitle,
                              { color: colors.textPrimary, fontWeight: isSelected ? '700' : '600' },
                            ]}
                          >
                            {item.title}
                          </Text>
                          <Text style={[styles.educationSubtitle, { color: colors.textSecondary }]}>
                            {item.subtitle}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                        )}
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 3. Age & Gender Row */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Age</Text>
            <View style={styles.chipRow}>
              {AGE_PRESETS.map((preset) => {
                const isSelected = age === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.ageChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.borderSubtle,
                      },
                    ]}
                    onPress={() => handleAgePreset(preset)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.onPrimary : colors.textPrimary },
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View
                style={[
                  styles.customAgeBox,
                  { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
                ]}
              >
                <TextInput
                  value={customAgeInput}
                  onChangeText={handleCustomAgeChange}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="Other"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.customAgeInput, { color: colors.textPrimary }]}
                />
              </View>
            </View>
          </View>

          {/* 4. Gender */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => {
                const isSelected = gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.borderSubtle,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      setGender(g);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? colors.onPrimary : colors.textPrimary },
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: isFormValid ? colors.primary : colors.surfaceSubtle,
                opacity: isFormValid ? 1 : 0.6,
              },
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <>
                <Text
                  style={[
                    styles.submitButtonText,
                    { color: isFormValid ? colors.onPrimary : colors.textTertiary },
                  ]}
                >
                  Complete Setup & Start Studying
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={isFormValid ? colors.onPrimary : colors.textTertiary}
                />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {isLoading && (
        <ThemedLoader
          title="Setting Up Profile"
          stage="Configuring your personalized AI study space..."
          variant="primary"
          size="medium"
          overlay
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 20,
  },
  topBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  studioLogo: {
    width: 24,
    height: 24,
  },
  studioCaption: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.presets.headline,
    fontSize: 26,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.presets.bodyMedium,
    lineHeight: 20,
  },
  fieldSection: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  fieldSubLabel: {
    ...typography.presets.bodySmall,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    ...shadows.subtle,
  },
  atPrefix: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 4,
  },
  input: {
    flex: 1,
    ...typography.presets.bodyLarge,
    fontSize: 16,
  },
  inputStatusIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    ...typography.presets.bodySmall,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  educationList: {
    gap: spacing.sm,
  },
  educationCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  educationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  educationIconCircle: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  educationTitle: {
    ...typography.presets.titleSmall,
    fontSize: 15,
  },
  educationSubtitle: {
    ...typography.presets.bodySmall,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    alignItems: 'center',
  },
  ageChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  customAgeBox: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    justifyContent: 'center',
  },
  customAgeInput: {
    fontSize: 14,
    fontWeight: '600',
    width: 44,
    textAlign: 'center',
  },
  genderChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...typography.presets.labelMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    ...shadows.card,
  },
  submitButtonText: {
    ...typography.presets.labelLarge,
    fontSize: 15,
    fontWeight: '700',
  },
});
