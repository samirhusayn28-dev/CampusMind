import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useHabitStore } from '../store/useHabitStore';

class StudyTimerService {
  private activeSessions = new Set<string>();
  private sessionStartTime: number | null = null;
  private accumulatedSeconds: number = 0;

  constructor() {
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState !== 'active') {
      // App minimized or in background - pause session and flush accumulated time
      this.pauseAndFlush();
    } else if (this.activeSessions.size > 0) {
      // Returned to foreground with active study screen - resume timer
      this.sessionStartTime = Date.now();
    }
  };

  /**
   * Start a study timer for a given screen/session identifier
   */
  startSession(sessionId: string) {
    if (this.activeSessions.size === 0) {
      this.sessionStartTime = Date.now();
    }
    this.activeSessions.add(sessionId);
  }

  /**
   * Stop a study timer for a given screen/session identifier
   */
  stopSession(sessionId: string) {
    this.activeSessions.delete(sessionId);
    if (this.activeSessions.size === 0) {
      this.pauseAndFlush();
    }
  }

  /**
   * Calculate elapsed active time and flush if >= 60 seconds
   */
  private async pauseAndFlush() {
    if (this.sessionStartTime) {
      const elapsedSec = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.accumulatedSeconds += Math.max(0, elapsedSec);
      this.sessionStartTime = null;
    }

    if (this.accumulatedSeconds >= 60) {
      const minutesToLog = Math.floor(this.accumulatedSeconds / 60);
      this.accumulatedSeconds = this.accumulatedSeconds % 60;
      await this.persistMinutes(minutesToLog);
    }
  }

  /**
   * Persist logged minutes to local stores and Firestore
   */
  private async persistMinutes(minutes: number) {
    if (minutes <= 0) return;

    const user = useAuthStore.getState().user;
    if (!user) return;

    const currentTotal = user.totalStudyTimeMinutes || 0;
    const newTotal = currentTotal + minutes;

    // 1. Update in-memory auth store
    useAuthStore.getState().updateUserProfile({
      totalStudyTimeMinutes: newTotal,
    });

    // 2. Log to habit tracker store
    useHabitStore.getState().logStudyMinutes(minutes, user.uid).catch(() => {});

    // 3. Persist to Firestore user document
    if (!user.isAnonymous && !user.uid.startsWith('guest_')) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            totalStudyTimeMinutes: increment(minutes),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[StudyTimer] Error saving study minutes to Firestore:', err);
      }
    }
  }

  /**
   * Force flush any remaining seconds (rounds up if >= 30 seconds)
   */
  async forceFlushRemaining() {
    if (this.sessionStartTime) {
      const elapsedSec = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.accumulatedSeconds += Math.max(0, elapsedSec);
      this.sessionStartTime = null;
    }

    if (this.accumulatedSeconds >= 30) {
      const minutes = Math.max(1, Math.round(this.accumulatedSeconds / 60));
      this.accumulatedSeconds = 0;
      await this.persistMinutes(minutes);
    }
  }
}

export const studyTimer = new StudyTimerService();

/**
 * React hook to automatically start/stop study session for any screen
 */
export function useStudySession(sessionId: string) {
  useEffect(() => {
    studyTimer.startSession(sessionId);
    return () => {
      studyTimer.stopSession(sessionId);
    };
  }, [sessionId]);
}
