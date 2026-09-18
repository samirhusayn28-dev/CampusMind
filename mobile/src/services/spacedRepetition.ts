import { StudyMaterial } from '../types/content';

export interface SpacedReviewResult {
  lastReviewedAt: string;
  nextReviewDate: string;
  reviewIntervalDays: number;
  easeFactor: number;
  repetitionNumber: number;
  lastReviewScore: number;
  retentionStatus: 'new' | 'learning' | 'review_due' | 'mastered';
}

/**
 * Calculates SM-2 spaced repetition parameters based on quiz / review performance
 */
export function calculateNextReview(
  material: StudyMaterial,
  scorePercent: number
): SpacedReviewResult {
  const currentRepetition = material.repetitionNumber || 0;
  const currentEase = material.easeFactor || 2.2;
  const currentInterval = material.reviewIntervalDays || 1;

  let newRepetition = currentRepetition;
  let newInterval = currentInterval;
  let newEase = currentEase;
  let newStatus: 'new' | 'learning' | 'review_due' | 'mastered' = 'learning';

  if (scorePercent >= 80) {
    // High comprehension: advance schedule
    newRepetition = currentRepetition + 1;
    if (newRepetition === 1) {
      newInterval = 1;
    } else if (newRepetition === 2) {
      newInterval = 3;
    } else if (newRepetition === 3) {
      newInterval = 7;
    } else {
      newInterval = Math.round(currentInterval * currentEase);
    }
    newEase = Math.min(2.8, currentEase + 0.1);
    newStatus = newRepetition >= 4 ? 'mastered' : 'learning';
  } else if (scorePercent >= 60) {
    // Moderate comprehension: increment cautiously
    newRepetition = currentRepetition + 1;
    newInterval = Math.max(1, Math.round(currentInterval * 1.3));
    newEase = Math.max(1.3, currentEase - 0.08);
    newStatus = 'learning';
  } else {
    // Weak recall: reset cycle for active reinforcement
    newRepetition = 0;
    newInterval = 1;
    newEase = Math.max(1.3, currentEase - 0.2);
    newStatus = 'review_due';
  }

  const now = new Date();
  const nextDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    lastReviewedAt: now.toISOString(),
    nextReviewDate: nextDate.toISOString(),
    reviewIntervalDays: newInterval,
    easeFactor: Number(newEase.toFixed(2)),
    repetitionNumber: newRepetition,
    lastReviewScore: scorePercent,
    retentionStatus: newStatus,
  };
}

/**
 * Checks if a study material is currently due for revision
 */
export function isDueForReview(material: StudyMaterial): boolean {
  if (!material.nextReviewDate) {
    return true; // Unreviewed material is due
  }
  const next = new Date(material.nextReviewDate).getTime();
  const now = Date.now();
  return next <= now;
}

export interface ReviewBadgeDetails {
  label: string;
  variant: 'sage' | 'peach' | 'lavender' | 'sky';
  isDue: boolean;
}

/**
 * Returns human-friendly badge info for spaced repetition status
 */
export function getReviewBadge(material: StudyMaterial): ReviewBadgeDetails {
  if (material.retentionStatus === 'mastered') {
    return {
      label: 'Mastered 🌟',
      variant: 'sage',
      isDue: false,
    };
  }

  if (!material.nextReviewDate) {
    return {
      label: 'New • Ready',
      variant: 'lavender',
      isDue: true,
    };
  }

  const nextTime = new Date(material.nextReviewDate).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((nextTime - now) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      label: overdue === 1 ? 'Overdue 1d ⏰' : `Overdue ${overdue}d ⏰`,
      variant: 'peach',
      isDue: true,
    };
  }

  if (diffDays === 0) {
    return {
      label: 'Due Today 🌱',
      variant: 'peach',
      isDue: true,
    };
  }

  return {
    label: `Review in ${diffDays}d 📅`,
    variant: 'sky',
    isDue: false,
  };
}
