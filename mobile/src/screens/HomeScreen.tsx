import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useContentStore } from '../store/useContentStore';
import { ContentType, StudyMaterial } from '../types/content';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { IngestionModal } from '../components/IngestionModal';
import { HabitTrackerCard } from '../components/HabitTrackerCard';
import { isDueForReview, getReviewBadge } from '../services/spacedRepetition';
import { triggerHaptic } from '../services/haptics';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const { materials, loadMaterials, setActiveMaterial } = useContentStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<ContentType>('pdf');

  useEffect(() => {
    if (user?.uid) {
      loadMaterials(user.uid);
    }
  }, [user?.uid, loadMaterials]);

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Student';
  const streak = user?.studyStreak || 1;

  // Time-of-day greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${firstName} ☀️`;
    if (hour < 17) return `Good afternoon, ${firstName} ⛅`;
    if (hour < 22) return `Good evening, ${firstName} 🌙`;
    return `Late-night study session, ${firstName} ✨`;
  }, [firstName]);

  // Dynamic Spaced Repetition Due calculations
  const dueItems = useMemo(() => {
    return materials.filter((m) => isDueForReview(m));
  }, [materials]);

  const totalQuizzes = useMemo(() => {
    return materials.reduce((acc, m) => acc + (m.quiz ? m.quiz.length : 0), 0);
  }, [materials]);

  const dueItem = dueItems.length > 0 ? dueItems[0] : materials[0] || null;
  const reviewBadge = dueItem ? getReviewBadge(dueItem) : null;

  const quickActions: {
    title: string;
    subtitle: string;
    icon: string;
    bg: string;
    color: string;
    type: ContentType;
  }[] = [
    {
      title: 'Upload PDF',
      subtitle: 'Slides & textbooks',
      icon: 'document-text-outline',
      bg: colors.primaryContainer,
      color: colors.primary,
      type: 'pdf',
    },
    {
      title: 'YouTube Link',
      subtitle: 'Video lectures',
      icon: 'logo-youtube',
      bg: colors.peachContainer,
      color: colors.peach,
      type: 'youtube',
    },
    {
      title: 'Live Audio',
      subtitle: 'Record in class',
      icon: 'mic-outline',
      bg: colors.lavenderContainer,
      color: colors.lavender,
      type: 'audio',
    },
    {
      title: 'Handwritten OCR',
      subtitle: 'Whiteboards & notes',
      icon: 'camera-outline',
      bg: colors.skyContainer,
      color: colors.sky,
      type: 'ocr',
    },
  ];

  const handleOpenAction = (type: ContentType) => {
    triggerHaptic('lightImpact');
    setModalType(type);
    setModalVisible(true);
  };

  const getBadgeVariant = (type: ContentType) => {
    switch (type) {
      case 'youtube':
        return 'peach';
      case 'audio':
        return 'lavender';
      case 'ocr':
        return 'sky';
      case 'pdf':
      default:
        return 'sage';
    }
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Header
        title={greeting}
        subtitle="Your calm, daily study companion"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Full Comprehensive Habit Tracker Card */}
        <HabitTrackerCard />

        {/* Quick Learning Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{materials.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Notes & Docs</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.statNumber, { color: colors.lavender }]}>{totalQuizzes}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Practice Qs</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.statNumber, { color: colors.peach }]}>{dueItems.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Due Review</Text>
          </View>
        </View>

        {/* Today's Spaced Revision Preview */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Today's Revision
          </Text>
          {dueItems.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Library' })}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                View All ({dueItems.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {dueItem ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setActiveMaterial(dueItem);
              navigation.navigate('Quiz', { materialId: dueItem.id });
            }}
          >
            <Card variant="surface" style={styles.revisionCard}>
              <View style={styles.revisionHeader}>
                <View style={styles.revisionBadges}>
                  <Badge label={dueItem.subject || 'General Studies'} variant="lavender" />
                  {reviewBadge && <Badge label={reviewBadge.label} variant={reviewBadge.variant} />}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </View>

              <Text style={[styles.revisionTitle, { color: colors.textPrimary }]}>
                {dueItem.title}
              </Text>

              <Text style={[styles.revisionSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                {dueItem.summary?.overview ||
                  dueItem.extractedText.substring(0, 140) + '...'}
              </Text>

              <View style={[styles.revisionFooter, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.revisionActionTextWrapper}>
                  <Ionicons name="help-circle-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.revisionActionText, { color: colors.primary }]}>
                    {dueItem.quiz && dueItem.quiz.length > 0
                      ? `Take ${dueItem.quiz.length}-Question Spaced Quiz`
                      : 'Generate Spaced Practice Quiz'}
                  </Text>
                </View>
                <Text style={[styles.repetitionCounter, { color: colors.textTertiary }]}>
                  Level {dueItem.repetitionNumber || 0}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ) : (
          <Card variant="surface" style={styles.emptyRevisionCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={colors.primary} style={{ marginBottom: 6 }} />
            <Text style={[styles.emptyRevisionTitle, { color: colors.textPrimary }]}>
              All Caught Up!
            </Text>
            <Text style={[styles.emptyRevisionSubtitle, { color: colors.textSecondary }]}>
              Upload new lecture materials below to generate practice quizzes.
            </Text>
          </Card>
        )}

        {/* Quick Ingestion Section */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: spacing.md }]}>
          Add Study Material
        </Text>
        <View style={styles.grid}>
          {quickActions.map((action, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.actionCard, { backgroundColor: action.bg }]}
              onPress={() => handleOpenAction(action.type)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>
                {action.title}
              </Text>
              <Text style={[styles.actionSubtext, { color: colors.textSecondary }]}>
                {action.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Study Materials Section */}
        {materials.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Recent Materials
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Library' })}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>View Library</Text>
              </TouchableOpacity>
            </View>

            {materials.slice(0, 3).map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => {
                  setActiveMaterial(item);
                  navigation.navigate('Summary', { materialId: item.id });
                }}
              >
                <Card variant="surface" style={styles.recentCard}>
                  <View style={styles.recentCardHeader}>
                    <Badge
                      label={item.type.toUpperCase()}
                      variant={getBadgeVariant(item.type)}
                    />
                    <Text style={[styles.recentSubject, { color: colors.textTertiary }]}>
                      {item.subject}
                    </Text>
                  </View>
                  <Text style={[styles.recentTitle, { color: colors.textPrimary }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.recentSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.summary?.overview || item.extractedText.substring(0, 120)}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Ingestion Modal */}
      <IngestionModal
        visible={modalVisible}
        initialType={modalType}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.massive,
  },
  streakCard: {
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  streakBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  streakBadgeText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  streakTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    fontSize: 17,
    marginBottom: spacing.xs,
  },
  streakSubtext: {
    ...typography.presets.bodySmall,
    lineHeight: 18,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.presets.headline,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    fontSize: 16,
  },
  viewAllText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  // Revision Card
  revisionCard: {
    marginBottom: spacing.lg,
  },
  revisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  revisionBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  revisionTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  revisionSummary: {
    ...typography.presets.bodySmall,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  revisionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  revisionActionTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revisionActionText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  repetitionCounter: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  emptyRevisionCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyRevisionTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyRevisionSubtitle: {
    ...typography.presets.caption,
    textAlign: 'center',
  },
  // Grid Actions
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  actionCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    ...typography.presets.labelLarge,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  actionSubtext: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  // Recent Cards
  recentCard: {
    marginBottom: spacing.sm,
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  recentSubject: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  recentTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  recentSnippet: {
    ...typography.presets.bodySmall,
    lineHeight: 17,
  },
});
