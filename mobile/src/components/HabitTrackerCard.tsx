import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  useHabitStore,
  getTodayDateKey,
  Habit,
} from '../store/useHabitStore';
import { showThemedAlert } from '../store/useNotificationStore';
import { triggerHaptic } from '../services/haptics';
import { Card } from './Card';
import { Badge } from './Badge';
import { typography, spacing, borderRadius, shadows } from '../theme';

export const HabitTrackerCard: React.FC = () => {
  const colors = useThemeStore((state) => state.colors);
  const isDark = useThemeStore((state) => state.isDark);
  const user = useAuthStore((state) => state.user);

  const {
    habits,
    dailyGoalMinutes,
    dailyGoalLectures,
    studyStatsByDate,
    currentStreak,
    longestStreak,
    toggleHabit,
    addHabit,
    deleteHabit,
    logStudyMinutes,
    logLectureCompleted,
  } = useHabitStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('book-outline');

  const todayKey = getTodayDateKey();
  const todayStats = studyStatsByDate[todayKey] || { minutesStudied: 0, lecturesCompleted: 0 };

  // Calculate today's habit completion
  const totalHabits = habits.length;
  const completedHabitsToday = habits.filter((h) => h.completedDates.includes(todayKey)).length;
  const habitCompletionRate = totalHabits > 0 ? completedHabitsToday / totalHabits : 0;

  // Minutes progress
  const minutesProgress = Math.min(1, todayStats.minutesStudied / Math.max(1, dailyGoalMinutes));

  // Adaptive encouraging message
  const adaptiveMessage = useMemo(() => {
    if (completedHabitsToday === totalHabits && totalHabits > 0) {
      return {
        title: 'All Habits Completed! 🌟',
        subtitle: 'You crushed all your study goals today. Outstanding discipline!',
      };
    }
    if (currentStreak >= 7) {
      return {
        title: 'One-Week Mastery! 💎',
        subtitle: 'Consistency is turning knowledge into second nature.',
      };
    }
    if (currentStreak >= 3) {
      return {
        title: 'Momentum is Building! 🔥',
        subtitle: 'Keep your streak alive. Even 10 focused minutes count.',
      };
    }
    if (completedHabitsToday > 0) {
      return {
        title: 'Great Start Today! 🌱',
        subtitle: `${completedHabitsToday} of ${totalHabits} habits done. Keep the flow going.`,
      };
    }
    return {
      title: 'Ready for Today’s Session? 📚',
      subtitle: 'Active recall and bite-sized habits build long-term mastery.',
    };
  }, [completedHabitsToday, totalHabits, currentStreak]);

  // Generate last 14 days calendar heatmap data
  const heatmapDays = useMemo(() => {
    const days: Array<{
      dateKey: string;
      dayOfWeek: string;
      dayNumber: number;
      isToday: boolean;
      activityLevel: 'none' | 'partial' | 'full';
    }> = [];

    const now = new Date();
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dayStr}`;

      const habitsCount = habits.filter((h) => h.completedDates.includes(dateKey)).length;
      const stats = studyStatsByDate[dateKey];
      const hasMinutes = stats && stats.minutesStudied > 0;
      const hasLectures = stats && stats.lecturesCompleted > 0;

      let activityLevel: 'none' | 'partial' | 'full' = 'none';
      if (habitsCount >= 2 || (hasMinutes && stats.minutesStudied >= 25) || hasLectures) {
        activityLevel = 'full';
      } else if (habitsCount > 0 || hasMinutes) {
        activityLevel = 'partial';
      }

      days.push({
        dateKey,
        dayOfWeek: dayNames[d.getDay()],
        dayNumber: d.getDate(),
        isToday: dateKey === todayKey,
        activityLevel,
      });
    }

    return days;
  }, [habits, studyStatsByDate, todayKey]);

  const handleToggle = async (habitId: string) => {
    triggerHaptic('mediumImpact');
    await toggleHabit(habitId, todayKey, user?.uid);
  };

  const handleCreateHabit = async () => {
    if (!newHabitTitle.trim()) {
      showThemedAlert('Habit Name', 'Please enter a name for your habit.');
      return;
    }
    triggerHaptic('successNotification');
    await addHabit(newHabitTitle.trim(), newHabitIcon, user?.uid);
    setNewHabitTitle('');
    setIsAddModalOpen(false);
    showThemedAlert('Habit Added', 'New daily study habit created!');
  };

  const handleDeleteHabit = (habit: Habit) => {
    showThemedAlert(
      'Remove Habit',
      `Delete "${habit.title}" from your daily tracker?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteHabit(habit.id, user?.uid);
            showThemedAlert('Removed', 'Habit has been deleted.');
          },
        },
      ]
    );
  };

  const handleAddStudyTime = async (minutes: number) => {
    await logStudyMinutes(minutes, user?.uid);
    showThemedAlert('Time Logged', `Added +${minutes}m to today's study log!`);
  };

  const iconOptions = [
    'book-outline',
    'sparkles',
    'timer-outline',
    'bulb-outline',
    'fitness-outline',
    'pencil-outline',
    'school-outline',
    'headset-outline',
  ];

  return (
    <Card variant="sage" style={styles.container}>
      {/* 1. Header with Streak & Longest Streak */}
      <View style={styles.headerRow}>
        <View style={styles.streakPillRow}>
          <View style={[styles.streakPill, { backgroundColor: colors.primary }]}>
            <Ionicons name="flame" size={16} color={colors.onPrimary} style={{ marginRight: 4 }} />
            <Text style={[styles.streakPillText, { color: colors.onPrimary }]}>
              {currentStreak} {currentStreak === 1 ? 'Day Streak' : 'Days Streak'}
            </Text>
          </View>
          <View style={[styles.recordPill, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="trophy-outline" size={13} color={colors.peach} style={{ marginRight: 4 }} />
            <Text style={[styles.recordPillText, { color: colors.textSecondary }]}>
              Best: {longestStreak}d
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addHabitBtn, { backgroundColor: colors.surface }]}
          onPress={() => setIsAddModalOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={[styles.addHabitBtnText, { color: colors.primary }]}>New Habit</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Adaptive Encouragement Headline */}
      <Text style={[styles.motivationalTitle, { color: colors.onPrimaryContainer }]}>
        {adaptiveMessage.title}
      </Text>
      <Text style={[styles.motivationalSubtitle, { color: colors.textSecondary }]}>
        {adaptiveMessage.subtitle}
      </Text>

      {/* 3. Daily Study Goal Progress Bar */}
      <View style={[styles.goalSection, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.6)' }]}>
        <View style={styles.goalHeaderRow}>
          <View style={styles.goalTitleRow}>
            <Ionicons name="time-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.goalTitle, { color: colors.textPrimary }]}>
              Daily Focus Target
            </Text>
          </View>
          <Text style={[styles.goalProgressNumbers, { color: colors.textSecondary }]}>
            {todayStats.minutesStudied} / {dailyGoalMinutes} min
          </Text>
        </View>

        {/* Progress Bar Track */}
        <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceSubtle }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.round(minutesProgress * 100)}%`,
              },
            ]}
          />
        </View>

        {/* Quick Log Buttons */}
        <View style={styles.quickTimeRow}>
          <TouchableOpacity
            style={[styles.quickTimePill, { backgroundColor: colors.surface }]}
            onPress={() => handleAddStudyTime(15)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
            <Text style={[styles.quickTimeText, { color: colors.textPrimary }]}>+15 min</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickTimePill, { backgroundColor: colors.surface }]}
            onPress={() => handleAddStudyTime(30)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
            <Text style={[styles.quickTimeText, { color: colors.textPrimary }]}>+30 min</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickTimePill, { backgroundColor: colors.surface }]}
            onPress={async () => {
              await logLectureCompleted(user?.uid);
              showThemedAlert('Completed!', '1 lecture logged toward today’s review.');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-done" size={14} color={colors.peach} />
            <Text style={[styles.quickTimeText, { color: colors.textPrimary }]}>+1 Lecture</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Visual 14-Day Calendar Heatmap */}
      <View style={styles.heatmapSection}>
        <View style={styles.heatmapHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            14-Day Consistency Heatmap
          </Text>
          <Text style={[styles.heatmapLegendText, { color: colors.textSecondary }]}>
            Past 2 Weeks
          </Text>
        </View>

        <View style={styles.heatmapGrid}>
          {heatmapDays.map((d) => {
            const isFull = d.activityLevel === 'full';
            const isPartial = d.activityLevel === 'partial';

            return (
              <View key={d.dateKey} style={styles.heatmapCol}>
                <Text style={[styles.heatmapDayOfWeek, { color: colors.textTertiary }]}>
                  {d.dayOfWeek}
                </Text>
                <View
                  style={[
                    styles.heatmapCell,
                    {
                      backgroundColor: isFull
                        ? colors.primary
                        : isPartial
                        ? isDark ? 'rgba(76, 122, 84, 0.45)' : colors.primaryLight
                        : isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surfaceSubtle,
                      borderColor: d.isToday
                        ? colors.primary
                        : 'transparent',
                      borderWidth: d.isToday ? 2 : 0,
                    },
                  ]}
                >
                  {isFull ? (
                    <Ionicons name="checkmark" size={10} color={colors.onPrimary} />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.heatmapDayNum,
                    {
                      color: d.isToday
                        ? colors.primary
                        : colors.textSecondary,
                      fontWeight: d.isToday ? '700' : '400',
                    },
                  ]}
                >
                  {d.dayNumber}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 5. Habits Checklist for Today */}
      <View style={styles.habitsListSection}>
        <View style={styles.habitsHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            Today's High-Yield Habits
          </Text>
          <Badge
            label={`${completedHabitsToday}/${totalHabits}`}
            variant={completedHabitsToday === totalHabits && totalHabits > 0 ? 'sage' : 'subtle'}
          />
        </View>

        <View style={styles.habitsList}>
          {habits.map((habit) => {
            const isCompleted = habit.completedDates.includes(todayKey);

            return (
              <View
                key={habit.id}
                style={[
                  styles.habitItemRow,
                  {
                    backgroundColor: isCompleted
                      ? isDark ? 'rgba(76, 122, 84, 0.2)' : 'rgba(218, 235, 221, 0.65)'
                      : colors.surface,
                    borderColor: isCompleted
                      ? colors.primary
                      : colors.borderSubtle,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.habitMainClickArea}
                  onPress={() => handleToggle(habit.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      {
                        backgroundColor: isCompleted ? colors.primary : 'transparent',
                        borderColor: isCompleted ? colors.primary : colors.textSecondary,
                      },
                    ]}
                  >
                    {isCompleted && (
                      <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                    )}
                  </View>

                  <View
                    style={[
                      styles.habitIconWrapper,
                      { backgroundColor: isCompleted ? colors.primaryLight : colors.surfaceSubtle },
                    ]}
                  >
                    <Ionicons
                      name={habit.icon as any || 'book-outline'}
                      size={15}
                      color={isCompleted ? colors.primary : colors.textSecondary}
                    />
                  </View>

                  <Text
                    style={[
                      styles.habitTitleText,
                      {
                        color: isCompleted ? colors.textPrimary : colors.textPrimary,
                        textDecorationLine: isCompleted ? 'line-through' : 'none',
                        opacity: isCompleted ? 0.8 : 1,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {habit.title}
                  </Text>
                </TouchableOpacity>

                {/* Delete button (only show for custom habits or long list) */}
                {habits.length > 2 && (
                  <TouchableOpacity
                    style={styles.habitDeleteBtn}
                    onPress={() => handleDeleteHabit(habit)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Add Custom Habit Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                New Study Habit
              </Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Habit Name
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.borderSubtle,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="e.g. Read 1 lecture, solve 10 questions"
              placeholderTextColor={colors.textTertiary}
              value={newHabitTitle}
              onChangeText={setNewHabitTitle}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>
              Choose Icon
            </Text>
            <View style={styles.iconSelectionRow}>
              {iconOptions.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[
                    styles.iconOptionBtn,
                    {
                      backgroundColor: newHabitIcon === ic ? colors.primary : colors.surfaceSubtle,
                      borderColor: newHabitIcon === ic ? colors.primary : colors.borderSubtle,
                    },
                  ]}
                  onPress={() => setNewHabitIcon(ic)}
                >
                  <Ionicons
                    name={ic as any}
                    size={18}
                    color={newHabitIcon === ic ? colors.onPrimary : colors.textPrimary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceSubtle }]}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateHabit}
              >
                <Text style={[styles.modalSaveText, { color: colors.onPrimary }]}>
                  Add Habit
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  streakPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
  },
  streakPillText: {
    ...typography.presets.bodySmall,
    fontWeight: '700',
  },
  recordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
  },
  recordPillText: {
    ...typography.presets.tiny,
    fontWeight: '600',
  },
  addHabitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  addHabitBtnText: {
    ...typography.presets.caption,
    fontWeight: '700',
  },
  motivationalTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  motivationalSubtitle: {
    ...typography.presets.caption,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  goalSection: {
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalTitle: {
    ...typography.presets.bodySmall,
    fontWeight: '700',
  },
  goalProgressNumbers: {
    ...typography.presets.caption,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs + 2,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quickTimeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    gap: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  quickTimeText: {
    ...typography.presets.tiny,
    fontWeight: '600',
  },
  heatmapSection: {
    marginBottom: spacing.md,
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeading: {
    ...typography.presets.bodySmall,
    fontWeight: '700',
  },
  heatmapLegendText: {
    ...typography.presets.tiny,
  },
  heatmapGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxs,
  },
  heatmapCol: {
    alignItems: 'center',
    gap: 3,
  },
  heatmapDayOfWeek: {
    ...typography.presets.tiny,
    fontSize: 9,
  },
  heatmapCell: {
    width: 17,
    height: 17,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapDayNum: {
    ...typography.presets.tiny,
    fontSize: 9,
  },
  habitsListSection: {
    marginTop: spacing.xxs,
  },
  habitsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  habitsList: {
    gap: spacing.xs,
  },
  habitItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  habitMainClickArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  habitIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  habitTitleText: {
    ...typography.presets.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  habitDeleteBtn: {
    padding: spacing.xxs,
    marginLeft: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.presets.titleLarge,
    fontWeight: '700',
  },
  inputLabel: {
    ...typography.presets.caption,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  iconSelectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  iconOptionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  modalCancelText: {
    ...typography.presets.bodySmall,
  },
  modalSaveBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.full,
  },
  modalSaveText: {
    ...typography.presets.bodySmall,
    fontWeight: '700',
  },
});
