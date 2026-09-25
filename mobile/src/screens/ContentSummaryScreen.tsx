import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useContentStore } from '../store/useContentStore';
import { useChatStore } from '../store/useChatStore';
import { ContentType, StudyMaterial, TranslatedContent } from '../types/content';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { ThemedLoader } from '../components/ThemedLoader';
import { showThemedAlert } from '../store/useNotificationStore';
import { speakText, stopSpeech, pauseSpeech, resumeSpeech } from '../services/speech';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useStudySession } from '../services/studyTimer';

interface ContentSummaryScreenProps {
  onBack: () => void;
  material?: StudyMaterial;
  materialId?: string;
  onNavigateToQuiz?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToConceptMap?: () => void;
}

type LanguageOption = 'en' | 'roman_urdu' | 'urdu';

export const ContentSummaryScreen: React.FC<ContentSummaryScreenProps> = ({
  onBack,
  material: propMaterial,
  materialId,
  onNavigateToQuiz,
  onNavigateToChat,
  onNavigateToConceptMap,
}) => {
  const { colors } = useThemeStore();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  useStudySession('content_summary');
  const {
    activeMaterial,
    materials,
    isSummarizing,
    isTranslating,
    generateSummaryForMaterial,
    translateMaterialSummary,
  } = useContentStore();

  const material =
    propMaterial ||
    (materialId ? materials.find((m) => m.id === materialId) : null) ||
    activeMaterial;

  const [language, setLanguage] = useState<LanguageOption>('en');
  const [showBilingual, setShowBilingual] = useState(false);
  const [showOriginalText, setShowOriginalText] = useState(false);

  // Audio Playback State (expo-speech)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  // Stop speech when navigating away
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  if (!material) {
    return (
      <View style={[styles.container, styles.emptyCenter, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No study material selected.
        </Text>
        <TouchableOpacity style={[styles.backBtnPill, { backgroundColor: colors.primary }]} onPress={onBack}>
          <Text style={[styles.backBtnText, { color: colors.onPrimary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleGenerateSummary = async () => {
    try {
      const userId = user?.uid || 'guest_user';
      await generateSummaryForMaterial(material.id, userId);
    } catch (err: any) {
      showThemedAlert('AI Error', err.message || 'Could not generate summary.');
    }
  };

  const handleLanguageChange = async (lang: LanguageOption) => {
    if (isPlayingAudio) {
      await stopSpeech();
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
    }

    setLanguage(lang);
    if (lang === 'en') return;

    const currentTranslations = material.summary?.translations;
    const isAlreadyTranslated =
      lang === 'roman_urdu' ? !!currentTranslations?.romanUrdu : !!currentTranslations?.urdu;

    if (!isAlreadyTranslated && material.summary) {
      try {
        const userId = user?.uid || 'guest_user';
        await translateMaterialSummary(material.id, lang, userId);
      } catch (err: any) {
        showThemedAlert('Translation Error', err.message || 'Could not translate summary.');
      }
    }
  };

  // Text-To-Speech Playback Controls
  const handlePlayPauseAudio = async () => {
    if (isPlayingAudio) {
      await pauseSpeech();
      setIsPlayingAudio(false);
      setIsAudioPaused(true);
      return;
    }

    if (isAudioPaused) {
      await resumeSpeech();
      setIsPlayingAudio(true);
      setIsAudioPaused(false);
      return;
    }

    if (!summary) return;

    // Assemble text based on current language
    const currentTrans =
      language === 'roman_urdu'
        ? summary.translations?.romanUrdu
        : language === 'urdu'
        ? summary.translations?.urdu
        : null;

    const titleText = currentTrans?.title || material.title;
    const overviewText = currentTrans?.overview || summary.fullSummary || summary.overview || '';
    const points = (currentTrans?.keyPoints || summary.keyPoints).join('. ');
    const headingsText = (currentTrans?.headings || summary.headings)
      .map((h) => `${h.title}: ${h.points.join(', ')}`)
      .join('. ');

    const fullSpeechText = `${titleText}. Overview: ${overviewText}. Key points: ${points}. Concepts: ${headingsText}.`;

    const speechLang =
      language === 'urdu'
        ? 'ur'
        : language === 'roman_urdu'
        ? 'en-IN'
        : 'en-US';

    try {
      setIsPlayingAudio(true);
      setIsAudioPaused(false);

      await speakText(fullSpeechText, {
        rate: speechRate,
        language: speechLang,
        onDone: () => {
          setIsPlayingAudio(false);
          setIsAudioPaused(false);
        },
        onStopped: () => {
          setIsPlayingAudio(false);
          setIsAudioPaused(false);
        },
        onError: (e) => {
          console.warn('Speech error:', e);
          setIsPlayingAudio(false);
          setIsAudioPaused(false);
        },
      });
    } catch (err: any) {
      setIsPlayingAudio(false);
      setIsAudioPaused(false);
      showThemedAlert('Speech Error', err.message || 'Could not start speech playback.');
    }
  };

  const handleStopAudio = async () => {
    await stopSpeech();
    setIsPlayingAudio(false);
    setIsAudioPaused(false);
  };

  const handleCycleSpeechRate = async () => {
    const rates = [0.8, 1.0, 1.25, 1.5];
    const currentIndex = rates.indexOf(speechRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setSpeechRate(nextRate);

    // If currently playing, restart speech with new speed
    if (isPlayingAudio) {
      await stopSpeech();
      setTimeout(() => {
        handlePlayPauseAudio();
      }, 100);
    }
  };

  const getTypeBadge = (type: ContentType) => {
    switch (type) {
      case 'youtube': return { label: 'YouTube Video', variant: 'peach' as const };
      case 'audio': return { label: 'Audio Lecture', variant: 'lavender' as const };
      case 'ocr': return { label: 'Notes OCR', variant: 'sky' as const };
      case 'pdf':
      default: return { label: 'PDF Document', variant: 'sage' as const };
    }
  };

  const badge = getTypeBadge(material.type);
  const summary = material.summary;

  // Active translation
  const translation: TranslatedContent | undefined =
    language === 'roman_urdu'
      ? summary?.translations?.romanUrdu
      : language === 'urdu'
      ? summary?.translations?.urdu
      : undefined;

  const isRtl = language === 'urdu';

  const languageLabel =
    language === 'roman_urdu' ? 'Roman Urdu' : language === 'urdu' ? 'Urdu' : 'English';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderSubtle, paddingTop: Math.max(insets.top, spacing.md) }]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surfaceSubtle }]}
          onPress={() => {
            stopSpeech();
            onBack();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.topBadgesRow}>
          <Badge label={material.subject} variant="subtle" />
          <Badge label={badge.label} variant={badge.variant} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + spacing.xl, spacing.massive) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title & Metadata */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {language !== 'en' && translation?.title ? translation.title : material.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="document-text-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {material.wordCount} words
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {new Date(material.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* If summary exists: Audio Playback Bar + Language Switcher */}
        {summary && (
          <View style={styles.topControlsSection}>
            {/* Listen Button / Audio Player Bar */}
            <AudioPlayerBar
              isPlaying={isPlayingAudio}
              isPaused={isAudioPaused}
              rate={speechRate}
              languageLabel={languageLabel}
              onPlayPause={handlePlayPauseAudio}
              onStop={handleStopAudio}
              onToggleRate={handleCycleSpeechRate}
            />

            {/* Language Selector Bar */}
            <View style={[styles.languageToggleBar, { backgroundColor: colors.surfaceSubtle }]}>
              <TouchableOpacity
                style={[
                  styles.langTab,
                  language === 'en' && { backgroundColor: colors.surface, ...shadows.subtle },
                ]}
                onPress={() => handleLanguageChange('en')}
              >
                <Text
                  style={[
                    styles.langTabText,
                    { color: language === 'en' ? colors.textPrimary : colors.textSecondary },
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.langTab,
                  language === 'roman_urdu' && { backgroundColor: colors.surface, ...shadows.subtle },
                ]}
                onPress={() => handleLanguageChange('roman_urdu')}
              >
                <Text
                  style={[
                    styles.langTabText,
                    { color: language === 'roman_urdu' ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Roman Urdu
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.langTab,
                  language === 'urdu' && { backgroundColor: colors.surface, ...shadows.subtle },
                ]}
                onPress={() => handleLanguageChange('urdu')}
              >
                <Text
                  style={[
                    styles.langTabText,
                    { color: language === 'urdu' ? colors.peach : colors.textSecondary },
                  ]}
                >
                  اردو (Urdu)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bilingual Side-by-Side Toggle (when non-English selected) */}
            {language !== 'en' && (
              <TouchableOpacity
                style={[
                  styles.bilingualOptionRow,
                  { backgroundColor: showBilingual ? colors.primaryContainer : colors.surfaceSubtle },
                ]}
                onPress={() => setShowBilingual(!showBilingual)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={showBilingual ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={showBilingual ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.bilingualOptionText,
                    { color: showBilingual ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Show English Alongside Translation (Bilingual Study Mode)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Translation Loading State */}
        {isTranslating && (
          <Card variant="sage" style={styles.translatingCard}>
            <ThemedLoader
              stage={`Translating summary into ${language === 'roman_urdu' ? 'Roman Urdu' : 'Urdu'}...`}
              icon="language-outline"
              variant="primary"
              size="small"
            />
          </Card>
        )}

        {/* If no summary yet: Call AI to generate */}
        {!summary ? (
          isSummarizing ? (
            <Card variant="sage" style={styles.generatePromptCard}>
              <ThemedLoader
                title="Generating AI Summary"
                stage="Analyzing lecture content..."
                stages={[
                  'Analyzing lecture text and concepts...',
                  'Synthesizing 5–10 core takeaways...',
                  'Structuring topic breakdown & high-yield exam tips...',
                  'Formatting bilingual knowledge points...',
                ]}
                subtext="CampusMind AI is distilling high-yield study notes."
                icon="sparkles"
                variant="primary"
                size="medium"
              />
            </Card>
          ) : (
            <Card variant="sage" style={styles.generatePromptCard}>
              <View style={[styles.aiIconWrapper, { backgroundColor: colors.surface }]}>
                <Ionicons name="sparkles" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.generateTitle, { color: colors.onPrimaryContainer }]}>
                Generate AI Study Summary
              </Text>
              <Text style={[styles.generateDesc, { color: colors.textSecondary }]}>
                CampusMind AI will analyze the extracted text, produce 5–10 key takeaways, and organize structured topic headings.
              </Text>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                onPress={handleGenerateSummary}
                activeOpacity={0.85}
              >
                <View style={styles.btnContentRow}>
                  <Ionicons name="sparkles" size={18} color={colors.onPrimary} />
                  <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>
                    Generate AI Summary
                  </Text>
                </View>
              </TouchableOpacity>
            </Card>
          )
        ) : (
          <>
            {/* Executive Overview Card */}
            <Card variant="surface" style={styles.sectionCard}>
              <View style={styles.cardHeaderWithBadge}>
                <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>
                  Executive Overview
                </Text>
                <Badge
                  label={language === 'en' ? 'CampusMind AI' : language === 'roman_urdu' ? 'Roman Urdu' : 'اردو'}
                  variant={language === 'en' ? 'sage' : language === 'roman_urdu' ? 'peach' : 'lavender'}
                />
              </View>

              {/* Translation text */}
              {language !== 'en' && translation?.overview ? (
                <Text
                  style={[
                    styles.overviewText,
                    { color: colors.textPrimary },
                    isRtl && styles.rtlText,
                  ]}
                >
                  {translation.overview}
                </Text>
              ) : null}

              {/* English text (if EN mode or bilingual mode) */}
              {(language === 'en' || showBilingual) && (
                <View style={language !== 'en' && styles.bilingualEnBlock}>
                  {language !== 'en' && (
                    <Text style={[styles.bilingualLabel, { color: colors.textTertiary }]}>
                      English Reference:
                    </Text>
                  )}
                  <Text style={[styles.overviewText, { color: colors.textSecondary }]}>
                    {summary.fullSummary || summary.overview}
                  </Text>
                </View>
              )}
            </Card>

            {/* 5-10 Key Points Card */}
            <Card variant="surface" style={styles.sectionCard}>
              <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>
                {language === 'urdu' ? 'کلیدی نکات' : language === 'roman_urdu' ? 'Ahem Nukaat (Key Takeaways)' : 'Key Takeaways'}
              </Text>
              <View style={styles.keyPointsList}>
                {(language !== 'en' && translation?.keyPoints ? translation.keyPoints : summary.keyPoints).map(
                  (pt, idx) => (
                    <View key={idx} style={[styles.keyPointRow, isRtl && styles.rtlRow]}>
                      <View
                        style={[
                          styles.pointNumberCircle,
                          {
                            backgroundColor:
                              language === 'roman_urdu'
                                ? colors.peachContainer
                                : language === 'urdu'
                                ? colors.lavenderContainer
                                : colors.primaryContainer,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pointNumberText,
                            {
                              color:
                                language === 'roman_urdu'
                                  ? colors.peach
                                  : language === 'urdu'
                                  ? colors.lavender
                                  : colors.primary,
                            },
                          ]}
                        >
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={styles.pointTextCol}>
                        <Text
                          style={[
                            styles.keyPointText,
                            { color: colors.textPrimary },
                            isRtl && styles.rtlText,
                          ]}
                        >
                          {pt}
                        </Text>
                        {showBilingual && language !== 'en' && summary.keyPoints[idx] && (
                          <Text style={[styles.bilingualSubText, { color: colors.textTertiary }]}>
                            EN: {summary.keyPoints[idx]}
                          </Text>
                        )}
                      </View>
                    </View>
                  )
                )}
              </View>
            </Card>

            {/* Structured Headings Breakdown */}
            {summary.headings && summary.headings.length > 0 && (
              <Card variant="surface" style={styles.sectionCard}>
                <Text style={[styles.cardSectionTitle, { color: colors.textPrimary }]}>
                  {language === 'urdu' ? 'موضوعات اور تصورات' : language === 'roman_urdu' ? 'Topic Headings (Topics & Concepts)' : 'Topic Headings & Concepts'}
                </Text>
                <View style={styles.headingsList}>
                  {(language !== 'en' && translation?.headings ? translation.headings : summary.headings).map(
                    (heading, hIdx) => (
                      <View key={hIdx} style={styles.headingItem}>
                        <View style={[styles.headingTitleRow, isRtl && styles.rtlRow]}>
                          <View style={[styles.headingPill, { backgroundColor: colors.peachContainer }]}>
                            <Text style={[styles.headingPillText, { color: colors.peach }]}>
                              {language === 'urdu' ? `حصہ ${hIdx + 1}` : `Section ${hIdx + 1}`}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.headingTitle,
                              { color: colors.textPrimary },
                              isRtl && styles.rtlText,
                            ]}
                          >
                            {heading.title}
                          </Text>
                        </View>
                        {heading.points.map((pt, pIdx) => (
                          <View key={pIdx} style={[styles.subPointRow, isRtl && styles.rtlRow]}>
                            <Text style={[styles.bulletSymbol, { color: colors.primary }]}>•</Text>
                            <View style={styles.pointTextCol}>
                              <Text
                                style={[
                                  styles.subPointText,
                                  { color: colors.textSecondary },
                                  isRtl && styles.rtlText,
                                ]}
                              >
                                {pt}
                              </Text>
                              {showBilingual &&
                                language !== 'en' &&
                                summary.headings[hIdx]?.points[pIdx] && (
                                  <Text style={[styles.bilingualSubText, { color: colors.textTertiary }]}>
                                    EN: {summary.headings[hIdx].points[pIdx]}
                                  </Text>
                                )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )
                  )}
                </View>
              </Card>
            )}

            {/* Quick Actions for Next Stages */}
            <View style={styles.actionRow}>
              {onNavigateToQuiz && (
                <TouchableOpacity
                  style={[styles.toolBtn, { backgroundColor: colors.peachContainer }]}
                  onPress={onNavigateToQuiz}
                  activeOpacity={0.8}
                >
                  <Ionicons name="help-circle-outline" size={18} color={colors.peach} />
                  <Text style={[styles.toolBtnText, { color: colors.peach }]}>Practice Quiz</Text>
                </TouchableOpacity>
              )}

              {onNavigateToChat && (
                <TouchableOpacity
                  style={[styles.toolBtn, { backgroundColor: colors.lavenderContainer }]}
                  onPress={() => {
                    if (material?.id) {
                      useChatStore.getState().setSelectedMaterialId(material.id);
                    }
                    onNavigateToChat();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.lavender} />
                  <Text style={[styles.toolBtnText, { color: colors.lavender }]}>Study Chat</Text>
                </TouchableOpacity>
              )}

              {onNavigateToConceptMap && (
                <TouchableOpacity
                  style={[styles.toolBtn, { backgroundColor: colors.skyContainer }]}
                  onPress={onNavigateToConceptMap}
                  activeOpacity={0.8}
                >
                  <Ionicons name="git-network-outline" size={18} color={colors.sky} />
                  <Text style={[styles.toolBtnText, { color: colors.sky }]}>Concept Map</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Collapsible Original Extracted Text Section */}
        <Card variant="subtle" style={styles.collapsibleCard}>
          <TouchableOpacity
            style={styles.collapsibleHeader}
            onPress={() => setShowOriginalText(!showOriginalText)}
            activeOpacity={0.7}
          >
            <View style={styles.collapsibleTitleRow}>
              <Ionicons
                name="reader-outline"
                size={18}
                color={colors.textPrimary}
                style={styles.collapseIcon}
              />
              <Text style={[styles.collapsibleTitle, { color: colors.textPrimary }]}>
                Original Extracted Text
              </Text>
            </View>
            <Ionicons
              name={showOriginalText ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showOriginalText && (
            <View style={[styles.originalTextBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.originalTextContent, { color: colors.textSecondary }]}>
                {material.extractedText}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.presets.bodyLarge,
    marginBottom: spacing.md,
  },
  backBtnPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  backBtnText: {
    ...typography.presets.labelLarge,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadgesRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.massive,
    gap: spacing.lg,
  },
  title: {
    ...typography.presets.headline,
    fontSize: 22,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: -spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.presets.caption,
  },
  topControlsSection: {
    gap: spacing.sm,
  },
  languageToggleBar: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    padding: spacing.xxs,
  },
  langTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  langTabText: {
    ...typography.presets.labelMedium,
    fontSize: 12,
  },
  bilingualOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  bilingualOptionText: {
    ...typography.presets.labelMedium,
    fontSize: 12,
  },
  translatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  translatingText: {
    ...typography.presets.bodySmall,
    flex: 1,
    fontWeight: '500',
  },
  generatePromptCard: {
    alignItems: 'center',
    textAlign: 'center',
    padding: spacing.xl,
    borderRadius: borderRadius.xxl,
  },
  aiIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  generateTitle: {
    ...typography.presets.titleLarge,
    marginBottom: spacing.xs,
  },
  generateDesc: {
    ...typography.presets.bodyMedium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  primaryActionBtn: {
    height: 50,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...shadows.card,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  primaryActionText: {
    ...typography.presets.labelLarge,
  },
  sectionCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
  },
  cardHeaderWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardSectionTitle: {
    ...typography.presets.titleMedium,
    marginBottom: spacing.md,
  },
  overviewText: {
    ...typography.presets.bodyMedium,
    lineHeight: 22,
  },
  bilingualEnBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  bilingualLabel: {
    ...typography.presets.labelMedium,
    fontSize: 11,
    marginBottom: 2,
  },
  keyPointsList: {
    gap: spacing.md,
  },
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  pointNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pointNumberText: {
    ...typography.presets.labelMedium,
    fontSize: 11,
    fontWeight: '700',
  },
  pointTextCol: {
    flex: 1,
  },
  keyPointText: {
    ...typography.presets.bodyMedium,
    lineHeight: 22,
  },
  bilingualSubText: {
    ...typography.presets.caption,
    marginTop: 2,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  headingsList: {
    gap: spacing.lg,
  },
  headingItem: {
    gap: spacing.xs,
  },
  headingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  headingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  headingPillText: {
    ...typography.presets.labelMedium,
    fontSize: 11,
  },
  headingTitle: {
    ...typography.presets.titleSmall,
    flex: 1,
  },
  subPointRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    paddingLeft: spacing.sm,
  },
  bulletSymbol: {
    fontSize: 16,
    lineHeight: 20,
  },
  subPointText: {
    flex: 1,
    ...typography.presets.bodySmall,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    height: 46,
    borderRadius: borderRadius.full,
  },
  toolBtnText: {
    ...typography.presets.labelLarge,
    fontSize: 13,
  },
  collapsibleCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  collapsibleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collapseIcon: {
    marginRight: 2,
  },
  collapsibleTitle: {
    ...typography.presets.labelLarge,
  },
  originalTextBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  originalTextContent: {
    ...typography.presets.bodySmall,
    lineHeight: 20,
  },
});
