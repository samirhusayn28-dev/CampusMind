import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useContentStore } from '../store/useContentStore';
import { useAuthStore } from '../store/useAuthStore';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { QuizQuestion } from '../types/content';

interface QuizScreenProps {
  onBack: () => void;
  materialId?: string;
  onNavigateToSummary?: () => void;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({
  onBack,
  materialId,
  onNavigateToSummary,
}) => {
  const { colors, isDark } = useThemeStore();
  const { user } = useAuthStore();
  const {
    activeMaterial,
    materials,
    isGeneratingQuiz,
    generateQuizForMaterial,
    recordMaterialReview,
  } = useContentStore();

  const currentMaterial = materialId
    ? materials.find((m) => m.id === materialId) || activeMaterial
    : activeMaterial;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [userAnswers, setUserAnswers] = useState<
    { questionId: string; selectedIndex: number; isCorrect: boolean }[]
  >([]);
  const [isQuizCompleted, setIsQuizCompleted] = useState(false);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  // Animation for feedback card
  const feedbackFadeAnim = useRef(new Animated.Value(0)).current;
  const feedbackSlideAnim = useRef(new Animated.Value(20)).current;

  // Progress animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOrGenerateQuiz();
  }, [currentMaterial?.id]);

  useEffect(() => {
    if (questions.length > 0) {
      Animated.timing(progressAnim, {
        toValue: (currentIndex + 1) / questions.length,
        duration: 350,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, questions.length]);

  const loadOrGenerateQuiz = async () => {
    if (!currentMaterial) return;

    if (currentMaterial.quiz && currentMaterial.quiz.length > 0) {
      setQuestions(currentMaterial.quiz);
      resetQuizState();
      return;
    }

    if (user?.uid) {
      setIsLocalLoading(true);
      try {
        const generated = await generateQuizForMaterial(currentMaterial.id, user.uid);
        setQuestions(generated);
        resetQuizState();
      } catch (err) {
        console.error('Failed to generate quiz:', err);
      } finally {
        setIsLocalLoading(false);
      }
    }
  };

  const resetQuizState = () => {
    setCurrentIndex(0);
    setSelectedOptionIndex(null);
    setHasAnswered(false);
    setUserAnswers([]);
    setIsQuizCompleted(false);
  };

  const handleSelectOption = (index: number) => {
    if (hasAnswered) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = index === currentQuestion.correctAnswerIndex;

    setSelectedOptionIndex(index);
    setHasAnswered(true);

    setUserAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedIndex: index,
        isCorrect,
      },
    ]);

    // Animate feedback card
    feedbackFadeAnim.setValue(0);
    feedbackSlideAnim.setValue(16);
    Animated.parallel([
      Animated.timing(feedbackFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(feedbackSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionIndex(null);
      setHasAnswered(false);
    } else {
      setIsQuizCompleted(true);
      if (currentMaterial) {
        const correct = userAnswers.filter((a) => a.isCorrect).length;
        const finalPercent = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
        recordMaterialReview(currentMaterial.id, finalPercent).catch((err) =>
          console.warn('Failed to record spaced review:', err)
        );
      }
    }
  };

  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const getScoreFeedback = () => {
    if (scorePercent === 100) {
      return {
        title: 'Outstanding Mastery! 🌟',
        subtitle: 'You scored 100%! Your conceptual grasp of this lecture is rock-solid.',
        badgeColor: colors.primaryContainer,
        badgeText: colors.primary,
      };
    }
    if (scorePercent >= 80) {
      return {
        title: 'Fantastic Performance! 🚀',
        subtitle: 'Great job! Your active recall is sharp and exam-ready. Keep this momentum!',
        badgeColor: colors.skyContainer,
        badgeText: colors.sky,
      };
    }
    if (scorePercent >= 60) {
      return {
        title: 'Solid Effort! 📚',
        subtitle: 'Good conceptual foundation. Reviewing the notes once more will cement the tricky details.',
        badgeColor: colors.lavenderContainer,
        badgeText: colors.lavender,
      };
    }
    return {
      title: 'Active Learning in Progress 🌱',
      subtitle: 'Quizzes are meant for finding knowledge gaps. Re-read the study summary and give it another shot!',
      badgeColor: colors.peachContainer,
      badgeText: colors.peach,
    };
  };

  // 1. Loading state
  if (isGeneratingQuiz || isLocalLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContainer}>
          <View style={[styles.loadingBadge, { backgroundColor: colors.peachContainer }]}>
            <Ionicons name="sparkles" size={32} color={colors.peach} />
          </View>
          <Text style={[styles.loadingHeader, { color: colors.textPrimary }]}>
            Crafting Your Quiz
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
            CampusMind AI is formulating high-yield active recall questions from{' '}
            {currentMaterial?.title || 'your lecture'}...
          </Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  // 2. Empty or error state
  if (!questions || questions.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surfaceSubtle }]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>Practice Quiz</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centerContainer}>
          <View style={[styles.loadingBadge, { backgroundColor: colors.lavenderContainer }]}>
            <Ionicons name="help-circle-outline" size={36} color={colors.lavender} />
          </View>
          <Text style={[styles.loadingHeader, { color: colors.textPrimary }]}>
            No Questions Available
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
            We couldn't locate or generate practice questions for this lecture yet.
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary, marginTop: spacing.xl }]}
            onPress={loadOrGenerateQuiz}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: spacing.xs }} />
            <Text style={styles.primaryActionBtnText}>Generate Quiz Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 3. Completed State / Scorecard
  if (isQuizCompleted) {
    const feedback = getScoreFeedback();

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.surfaceSubtle }]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>Quiz Results</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Score Card */}
          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={[styles.trophyCircle, { backgroundColor: feedback.badgeColor }]}>
              <Ionicons
                name={scorePercent >= 80 ? 'trophy' : scorePercent >= 60 ? 'ribbon' : 'school'}
                size={40}
                color={feedback.badgeText}
              />
            </View>

            <Text style={[styles.scoreTitle, { color: colors.textPrimary }]}>
              {feedback.title}
            </Text>
            <Text style={[styles.scoreSubtitle, { color: colors.textSecondary }]}>
              {feedback.subtitle}
            </Text>

            {/* Score Ring / Pill */}
            <View style={[styles.scorePill, { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.scoreBigText, { color: colors.primary }]}>
                {correctCount} / {questions.length}
              </Text>
              <Text style={[styles.scorePercentText, { color: colors.primary }]}>
                ({scorePercent}%)
              </Text>
            </View>

            <Text style={[styles.subjectCaption, { color: colors.textTertiary }]}>
              {currentMaterial?.subject} • {currentMaterial?.title}
            </Text>
          </View>

          {/* Breakdown / Review Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Question Breakdown
            </Text>
            <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
              {correctCount} Correct of {questions.length}
            </Text>
          </View>

          {questions.map((q, idx) => {
            const answer = userAnswers[idx];
            const isCorrect = answer?.isCorrect;

            return (
              <View
                key={q.id || `breakdown_${idx}`}
                style={[
                  styles.reviewItemCard,
                  {
                    backgroundColor: colors.surface,
                    borderLeftColor: isCorrect ? colors.primary : colors.peach,
                  },
                ]}
              >
                <View style={styles.reviewHeader}>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: isCorrect ? colors.primaryContainer : colors.peachContainer },
                    ]}
                  >
                    <Ionicons
                      name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={isCorrect ? colors.primary : colors.peach}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isCorrect ? colors.primary : colors.peach },
                      ]}
                    >
                      {isCorrect ? 'Correct' : 'Missed'}
                    </Text>
                  </View>
                  <Text style={[styles.reviewNumber, { color: colors.textTertiary }]}>
                    Q{idx + 1}
                  </Text>
                </View>

                <Text style={[styles.reviewQuestionText, { color: colors.textPrimary }]}>
                  {q.question}
                </Text>

                <View style={styles.reviewAnswersBox}>
                  <Text style={[styles.reviewAnswerLabel, { color: colors.textSecondary }]}>
                    Correct Answer:
                  </Text>
                  <Text style={[styles.reviewAnswerText, { color: colors.primary }]}>
                    {q.options[q.correctAnswerIndex]}
                  </Text>

                  {!isCorrect && answer && (
                    <>
                      <Text style={[styles.reviewAnswerLabel, { color: colors.peach, marginTop: spacing.xs }]}>
                        Your Choice:
                      </Text>
                      <Text style={[styles.reviewAnswerText, { color: colors.textSecondary }]}>
                        {q.options[answer.selectedIndex]}
                      </Text>
                    </>
                  )}
                </View>

                <View style={[styles.explanationContainer, { backgroundColor: colors.surfaceSubtle }]}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                    {q.explanation}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Action Buttons */}
          <View style={styles.bottomActionsContainer}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
              onPress={resetQuizState}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: spacing.xs }} />
              <Text style={styles.primaryActionBtnText}>Retake Practice Quiz</Text>
            </TouchableOpacity>

            {onNavigateToSummary && (
              <TouchableOpacity
                style={[styles.secondaryActionBtn, { backgroundColor: colors.primaryContainer, borderColor: colors.borderSubtle }]}
                onPress={onNavigateToSummary}
                activeOpacity={0.8}
              >
                <Ionicons name="book-outline" size={18} color={colors.primary} style={{ marginRight: spacing.xs }} />
                <Text style={[styles.secondaryActionBtnText, { color: colors.primary }]}>
                  Review Summary Notes
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.textActionBtn]}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <Text style={[styles.textActionBtnLabel, { color: colors.textSecondary }]}>
                Done & Return
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 4. Interactive Question Mode
  const currentQ = questions[currentIndex];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surfaceSubtle }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerInfoCenter}>
          <Text style={[styles.headerSubjectBadge, { color: colors.primary }]}>
            {currentMaterial?.subject || 'Lecture Quiz'}
          </Text>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>

        <View style={[styles.counterPill, { backgroundColor: colors.primaryContainer }]}>
          <Text style={[styles.counterPillText, { color: colors.primary }]}>
            {Math.round(((currentIndex + 1) / questions.length) * 100)}%
          </Text>
        </View>
      </View>

      {/* Material You Pastel Progress Track */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSubtle }]}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressWidth,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.questionScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Question Prompt Card */}
        <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.questionCardHeader}>
            <View style={[styles.qTag, { backgroundColor: colors.lavenderContainer }]}>
              <Text style={[styles.qTagText, { color: colors.lavender }]}>
                Concept Check
              </Text>
            </View>
            <Text style={[styles.qCounterText, { color: colors.textTertiary }]}>
              #{currentIndex + 1}
            </Text>
          </View>
          <Text style={[styles.questionPrompt, { color: colors.textPrimary }]}>
            {currentQ.question}
          </Text>
        </View>

        {/* Option Cards */}
        <View style={styles.optionsList}>
          {currentQ.options.map((optionText, optIndex) => {
            const isSelected = selectedOptionIndex === optIndex;
            const isCorrectAnswer = optIndex === currentQ.correctAnswerIndex;

            let cardBg = colors.surface;
            let cardBorder = colors.borderSubtle;
            let letterBg = colors.surfaceSubtle;
            let letterColor = colors.textSecondary;
            let textColor = colors.textPrimary;

            if (hasAnswered) {
              if (isCorrectAnswer) {
                // Correct option highlights pastel sage green
                cardBg = isDark ? '#1E2C22' : colors.primaryContainer;
                cardBorder = colors.primary;
                letterBg = colors.primary;
                letterColor = '#FFFFFF';
                textColor = isDark ? '#D2F5DC' : colors.primary;
              } else if (isSelected && !isCorrectAnswer) {
                // Wrong chosen option highlights pastel peach
                cardBg = isDark ? '#3A201B' : colors.peachContainer;
                cardBorder = colors.peach;
                letterBg = colors.peach;
                letterColor = '#FFFFFF';
                textColor = isDark ? '#FFD4C8' : colors.peach;
              } else {
                // Neutral unselected options dim slightly
                cardBg = isDark ? '#1E1E20' : colors.surfaceSubtle;
                cardBorder = colors.borderSubtle;
                letterBg = colors.surfaceSubtle;
                letterColor = colors.textTertiary;
                textColor = colors.textSecondary;
              }
            } else if (isSelected) {
              cardBg = colors.primaryContainer;
              cardBorder = colors.primary;
              letterBg = colors.primary;
              letterColor = '#FFFFFF';
            }

            return (
              <TouchableOpacity
                key={`opt_${optIndex}`}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                  },
                ]}
                onPress={() => handleSelectOption(optIndex)}
                activeOpacity={hasAnswered ? 1 : 0.75}
                disabled={hasAnswered}
              >
                <View style={[styles.letterCircle, { backgroundColor: letterBg }]}>
                  {hasAnswered && isCorrectAnswer ? (
                    <Ionicons name="checkmark" size={16} color={letterColor} />
                  ) : hasAnswered && isSelected && !isCorrectAnswer ? (
                    <Ionicons name="close" size={16} color={letterColor} />
                  ) : (
                    <Text style={[styles.letterText, { color: letterColor }]}>
                      {optionLetters[optIndex] || `${optIndex + 1}`}
                    </Text>
                  )}
                </View>

                <Text style={[styles.optionText, { color: textColor }]}>
                  {optionText}
                </Text>

                {hasAnswered && isCorrectAnswer && (
                  <View style={[styles.checkIndicator, { backgroundColor: colors.primaryContainer }]}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  </View>
                )}
                {hasAnswered && isSelected && !isCorrectAnswer && (
                  <View style={[styles.checkIndicator, { backgroundColor: colors.peachContainer }]}>
                    <Ionicons name="close-circle" size={20} color={colors.peach} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Instant Encouraging Educational Feedback */}
        {hasAnswered && (
          <Animated.View
            style={[
              styles.feedbackContainer,
              {
                backgroundColor: colors.surface,
                borderColor:
                  selectedOptionIndex === currentQ.correctAnswerIndex
                    ? colors.primary
                    : colors.peach,
                opacity: feedbackFadeAnim,
                transform: [{ translateY: feedbackSlideAnim }],
              },
            ]}
          >
            <View style={styles.feedbackHeaderRow}>
              <View
                style={[
                  styles.feedbackIconBadge,
                  {
                    backgroundColor:
                      selectedOptionIndex === currentQ.correctAnswerIndex
                        ? colors.primaryContainer
                        : colors.peachContainer,
                  },
                ]}
              >
                <Ionicons
                  name={
                    selectedOptionIndex === currentQ.correctAnswerIndex
                      ? 'sparkles'
                      : 'bulb-outline'
                  }
                  size={20}
                  color={
                    selectedOptionIndex === currentQ.correctAnswerIndex
                      ? colors.primary
                      : colors.peach
                  }
                />
              </View>

              <Text
                style={[
                  styles.feedbackTitle,
                  {
                    color:
                      selectedOptionIndex === currentQ.correctAnswerIndex
                        ? colors.primary
                        : colors.peach,
                  },
                ]}
              >
                {selectedOptionIndex === currentQ.correctAnswerIndex
                  ? 'Spot on! 🎉'
                  : 'Good try! 🌱'}
              </Text>
            </View>

            <Text style={[styles.feedbackExplanation, { color: colors.textPrimary }]}>
              {currentQ.explanation}
            </Text>

            <TouchableOpacity
              style={[
                styles.nextQuestionBtn,
                {
                  backgroundColor:
                    selectedOptionIndex === currentQ.correctAnswerIndex
                      ? colors.primary
                      : colors.peach,
                },
              ]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextQuestionBtnText}>
                {currentIndex + 1 < questions.length ? 'Next Question' : 'See Quiz Results'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
                style={{ marginLeft: spacing.xs }}
              />
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfoCenter: {
    alignItems: 'center',
    maxWidth: '65%',
  },
  headerSubjectBadge: {
    ...typography.presets.caption,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  topBarTitle: {
    ...typography.presets.titleSmall,
    fontSize: 16,
    fontWeight: '700',
  },
  counterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  counterPillText: {
    ...typography.presets.caption,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  questionScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.massive,
  },
  questionCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  questionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  qTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  qTagText: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  qCounterText: {
    ...typography.presets.caption,
    fontWeight: '600',
  },
  questionPrompt: {
    ...typography.presets.titleMedium,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  optionsList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  letterCircle: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  letterText: {
    ...typography.presets.bodyMedium,
    fontWeight: '700',
    fontSize: 14,
  },
  optionText: {
    ...typography.presets.bodyMedium,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  checkIndicator: {
    marginLeft: spacing.sm,
    borderRadius: borderRadius.full,
  },
  feedbackContainer: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  feedbackIconBadge: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  feedbackTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    fontSize: 16,
  },
  feedbackExplanation: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  nextQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  nextQuestionBtnText: {
    ...typography.presets.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  // Result / Score Screen Styles
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.massive,
  },
  scoreCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  trophyCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  scoreTitle: {
    ...typography.presets.headline,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  scoreSubtitle: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  scoreBigText: {
    ...typography.presets.headline,
    fontSize: 28,
    fontWeight: '800',
    marginRight: spacing.xs,
  },
  scorePercentText: {
    ...typography.presets.bodyLarge,
    fontWeight: '600',
  },
  subjectCaption: {
    ...typography.presets.caption,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    fontSize: 17,
  },
  sectionCount: {
    ...typography.presets.caption,
    fontWeight: '600',
  },
  reviewItemCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statusPillText: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  reviewNumber: {
    ...typography.presets.caption,
    fontWeight: '700',
  },
  reviewQuestionText: {
    ...typography.presets.bodyMedium,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  reviewAnswersBox: {
    marginBottom: spacing.sm,
  },
  reviewAnswerLabel: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reviewAnswerText: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  explanationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  explanationText: {
    ...typography.presets.caption,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  bottomActionsContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  primaryActionBtnText: {
    ...typography.presets.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    ...typography.presets.labelLarge,
    fontWeight: '700',
    fontSize: 15,
  },
  textActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  textActionBtnLabel: {
    ...typography.presets.labelMedium,
    fontWeight: '600',
  },
  // Loading & Center States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingBadge: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  loadingHeader: {
    ...typography.presets.headline,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  loadingSubtitle: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
});
