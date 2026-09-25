import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';

// Configure foreground notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationCategory = 'inactivity' | 'course' | 'streak' | 'revision';

export interface StudyReminderMessage {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
}

// Duolingo-style motivating, friendly, and quirky reminder pool (32 messages)
export const REMINDER_MESSAGES: StudyReminderMessage[] = [
  // 1. Inactivity Category (8 messages)
  {
    id: 'inactivity_1',
    category: 'inactivity',
    title: 'Your brain cells miss you! 🧠',
    body: 'Just 5 minutes of study today keeps the forgetting curve away.',
  },
  {
    id: 'inactivity_2',
    category: 'inactivity',
    title: 'Don’t leave your notes hanging 📚',
    body: 'A quick scroll through yesterday’s summary will do wonders.',
  },
  {
    id: 'inactivity_3',
    category: 'inactivity',
    title: 'Psst... future you will thank you! ✨',
    body: 'Open CampusMind for a 3-minute quiz and ace that upcoming midterm.',
  },
  {
    id: 'inactivity_4',
    category: 'inactivity',
    title: 'Study break over? ⏱️',
    body: 'Your lecture materials are resting, but exam day isn’t waiting!',
  },
  {
    id: 'inactivity_5',
    category: 'inactivity',
    title: 'Quick check-in! 🎒',
    body: 'Even looking at one flashcard today keeps your momentum rolling.',
  },
  {
    id: 'inactivity_6',
    category: 'inactivity',
    title: 'Knowledge is like coffee ☕',
    body: 'Best enjoyed fresh and daily. Tap to review your latest notes.',
  },
  {
    id: 'inactivity_7',
    category: 'inactivity',
    title: 'Ready for a mini study session? 💡',
    body: 'Reviewing one bite-sized concept now saves hours of cramming later.',
  },
  {
    id: 'inactivity_8',
    category: 'inactivity',
    title: 'Your study companion is waiting! 🐾',
    body: 'Hop back in for a super quick recap before calling it a day.',
  },

  // 2. Course-Specific Category (8 messages)
  {
    id: 'course_1',
    category: 'course',
    title: 'Course check: Got 5 minutes? 📖',
    body: 'Your recent course lectures have high-yield takeaways waiting for you.',
  },
  {
    id: 'course_2',
    category: 'course',
    title: 'Refresh your lecture memory 🎓',
    body: 'Listen to your auto-generated audio summary while walking or relaxing.',
  },
  {
    id: 'course_3',
    category: 'course',
    title: 'Lecture insights ready 🔍',
    body: 'We distilled key formulas and concepts from your uploaded slides.',
  },
  {
    id: 'course_4',
    category: 'course',
    title: 'Connect the dots in your courses 🗺️',
    body: 'Explore your interactive concept map to see how topics link together.',
  },
  {
    id: 'course_5',
    category: 'course',
    title: 'Key terms need a refresher 📝',
    body: 'Flip through your digital flashcards to cement core definitions.',
  },
  {
    id: 'course_6',
    category: 'course',
    title: 'Handwritten notes transcribed! ✍️',
    body: 'Your digitized class notes are ready for a quick active recall quiz.',
  },
  {
    id: 'course_7',
    category: 'course',
    title: 'Bilingual summary waiting 🌐',
    body: 'Check out your course review in Roman Urdu or Urdu for extra clarity.',
  },
  {
    id: 'course_8',
    category: 'course',
    title: 'Professor’s key points highlighted ⭐',
    body: 'See the most critical exam topics distilled from your recent class.',
  },

  // 3. Daily Streak / Habit Category (8 messages)
  {
    id: 'streak_1',
    category: 'streak',
    title: 'Protect your study streak! 🔥',
    body: 'Don’t let that flame go out! Complete a quick review to keep it alive.',
  },
  {
    id: 'streak_2',
    category: 'streak',
    title: 'You’re on a roll! 🚀',
    body: 'Keep your streak burning bright with today’s 2-minute habit check-off.',
  },
  {
    id: 'streak_3',
    category: 'streak',
    title: 'Consistency is your superpower ⚡',
    body: 'Another day, another step closer to top grades. Tap to keep going!',
  },
  {
    id: 'streak_4',
    category: 'streak',
    title: 'Streak check-in! 🏆',
    body: 'Champions study a little bit every single day. Let’s do this!',
  },
  {
    id: 'streak_5',
    category: 'streak',
    title: 'Almost bedtime, don’t lose your streak! 🌙',
    body: 'Take 60 seconds right now to log your study habit for the day.',
  },
  {
    id: 'streak_6',
    category: 'streak',
    title: 'You vs. yesterday: you’re winning! 📈',
    body: 'Keep the habit chain unbroken. Open CampusMind for a streak boost.',
  },
  {
    id: 'streak_7',
    category: 'streak',
    title: 'Streak alert: You’re doing amazing! 💪',
    body: 'Great habits build top students. Tap to lock in today’s progress.',
  },
  {
    id: 'streak_8',
    category: 'streak',
    title: '1 study habit completed = 1 victory 🎯',
    body: 'Check off your daily goal and celebrate your dedication today.',
  },

  // 4. Spaced Repetition / Revision Due (8 messages)
  {
    id: 'revision_1',
    category: 'revision',
    title: 'Active recall time! 🧠',
    body: 'Spaced repetition says this material is about to fade — test yourself now!',
  },
  {
    id: 'revision_2',
    category: 'revision',
    title: 'Quiz challenge ready 🎯',
    body: '6 quick multiple-choice questions to cement your memory for exams.',
  },
  {
    id: 'revision_3',
    category: 'revision',
    title: 'Revision due today 📅',
    body: 'Reviewing now moves this concept from short-term to long-term memory.',
  },
  {
    id: 'revision_4',
    category: 'revision',
    title: 'Beat the forgetting curve! 📉➡️📈',
    body: 'A quick 3-minute quiz locks in today’s review material permanently.',
  },
  {
    id: 'revision_5',
    category: 'revision',
    title: 'Memory booster active ⚡',
    body: 'Your spaced repetition schedule has 1 high-priority topic ready.',
  },
  {
    id: 'revision_6',
    category: 'revision',
    title: 'Test yourself before the exam does! 📝',
    body: 'Answer 3 practice questions now and spot any knowledge gaps.',
  },
  {
    id: 'revision_7',
    category: 'revision',
    title: 'Flashcard sprint! 🏃‍♂️',
    body: 'Can you get 5 out of 5 on your key terminology definitions today?',
  },
  {
    id: 'revision_8',
    category: 'revision',
    title: 'Lock it in for the finals 🔐',
    body: 'Your spaced repetition cards are due for a quick flip-through.',
  },
];

/**
 * Configure Android notification channels and request permissions
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('study-reminders', {
        name: 'Study Reminders & Revision',
        description: 'Notifications for study streaks, spaced repetition, and lecture recaps',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FD5607',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      console.log('[Notifications] Android channel "study-reminders" configured successfully.');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    const granted = finalStatus === 'granted';
    console.log('[Notifications] Permission status:', finalStatus, 'Granted:', granted);
    return granted;
  } catch (err) {
    console.error('[Notifications] Initialization or permission error:', err);
    return false;
  }
}

/**
 * Calculates next notification date within waking hours: 9:00 AM to 9:00 PM local time.
 */
function getNextWakingHourDate(targetHour: number = 18, targetMinute: number = 0, dayOffset: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  
  // Clamp hour to 9..20 (9 AM to 8 PM)
  const safeHour = Math.min(Math.max(targetHour, 9), 20);
  date.setHours(safeHour, targetMinute, 0, 0);

  // If time has passed today, schedule for tomorrow
  if (date.getTime() <= Date.now() + 60000) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

/**
 * Schedules a study reminder notification based on user settings
 */
export async function scheduleStudyReminder(
  customCategory?: NotificationCategory,
  dayOffset: number = 0
): Promise<string | null> {
  try {
    const settings = useSettingsStore.getState();
    if (!settings.studyRemindersEnabled) {
      console.log('[Notifications] Reminders disabled in settings, skipping schedule');
      return null;
    }

    // Filter messages by enabled categories
    const allowedCategories: NotificationCategory[] = [];
    if (settings.notificationInactivity) allowedCategories.push('inactivity');
    if (settings.notificationCourses) allowedCategories.push('course');
    if (settings.notificationStreak) allowedCategories.push('streak');
    if (settings.notificationRevision) allowedCategories.push('revision');

    if (allowedCategories.length === 0) {
      console.log('[Notifications] No notification categories enabled, skipping schedule');
      return null;
    }

    const targetCategory =
      customCategory && allowedCategories.includes(customCategory)
        ? customCategory
        : allowedCategories[Math.floor(Math.random() * allowedCategories.length)];

    const categoryPool = REMINDER_MESSAGES.filter((m) => m.category === targetCategory);
    const chosen = categoryPool[Math.floor(Math.random() * categoryPool.length)];

    // Parse user reminder time or default to 18:00 (6:00 PM)
    const [hStr, mStr] = (settings.reminderTime || '18:00').split(':');
    const targetHour = parseInt(hStr, 10) || 18;
    const targetMinute = parseInt(mStr, 10) || 0;

    const triggerDate = getNextWakingHourDate(targetHour, targetMinute, dayOffset);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: chosen.title,
        body: chosen.body,
        sound: 'default',
        channelId: 'study-reminders',
        data: { category: chosen.category, messageId: chosen.id },
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate.getTime(),
        channelId: 'study-reminders',
      } as any,
    });

    console.log(
      `[Notifications] Successfully scheduled reminder (${chosen.category}) ID: ${notificationId} for ${triggerDate.toLocaleString()}`
    );

    return notificationId;
  } catch (err) {
    console.error('[Notifications] Scheduling error:', err);
    return null;
  }
}

/**
 * Reschedules reminders according to current user preferences
 */
export async function rescheduleAllReminders(): Promise<void> {
  try {
    const isGranted = await initializeNotifications();
    if (!isGranted) {
      console.warn('[Notifications] Cannot reschedule reminders: permission not granted');
      return;
    }

    await cancelAllReminders();

    const settings = useSettingsStore.getState();
    if (!settings.studyRemindersEnabled) return;

    // Schedule next 2 upcoming reminders (today/tomorrow, day after tomorrow)
    await scheduleStudyReminder(undefined, 0);
    await scheduleStudyReminder(undefined, 1);
  } catch (err) {
    console.error('[Notifications] Error rescheduling all reminders:', err);
  }
}

/**
 * Schedule a quick test notification to verify delivery on-device
 */
export async function scheduleTestReminder(delaySeconds: number = 10): Promise<string | null> {
  try {
    const isGranted = await initializeNotifications();
    if (!isGranted) {
      console.warn('[Notifications] Test reminder aborted: permission not granted');
      return null;
    }

    const testNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Study Reminder Test 🎯',
        body: 'Notifications are working! Your study streak and revision alerts will arrive on schedule.',
        sound: 'default',
        channelId: 'study-reminders',
        data: { test: true },
      } as any,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(3, delaySeconds),
        repeats: false,
        channelId: 'study-reminders',
      } as any,
    });

    console.log(`[Notifications] Test reminder scheduled (fires in ${delaySeconds}s) ID: ${testNotificationId}`);
    return testNotificationId;
  } catch (err) {
    console.error('[Notifications] Error scheduling test reminder:', err);
    return null;
  }
}

/**
 * Cancel all scheduled study reminders
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] Cancelled all scheduled notifications');
  } catch (err) {
    console.warn('[Notifications] Cancel error:', err);
  }
}
