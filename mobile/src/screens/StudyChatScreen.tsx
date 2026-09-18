import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useContentStore } from '../store/useContentStore';
import { useChatStore } from '../store/useChatStore';
import { Header } from '../components/Header';
import { Badge } from '../components/Badge';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ChatLanguage, ChatMessage } from '../types/chat';
import { StudyMaterial } from '../types/content';

export const StudyChatScreen: React.FC = () => {
  const { colors, isDark } = useThemeStore();
  const { materials, activeMaterial, setActiveMaterial } = useContentStore();
  const {
    chatLanguage,
    setChatLanguage,
    isSending,
    selectedMaterialId,
    setSelectedMaterialId,
    getMessagesForMaterial,
    sendMessage,
    clearChat,
  } = useChatStore();

  const [inputText, setInputText] = useState('');
  const [expandedSourceMap, setExpandedSourceMap] = useState<Record<string, boolean>>({});

  const scrollViewRef = useRef<ScrollView>(null);

  // Determine current effective material
  const currentMaterial: StudyMaterial | null =
    selectedMaterialId !== null
      ? materials.find((m) => m.id === selectedMaterialId) || null
      : activeMaterial || (materials.length > 0 ? materials[0] : null);

  const messages = getMessagesForMaterial(currentMaterial?.id, currentMaterial);

  // Suggested prompt chips
  const suggestedPrompts = [
    '📌 Summarize the 3 most crucial exam points',
    '💡 What is the most common mistake students make here?',
    '🔍 Explain the core mechanism in simple everyday terms',
    '❓ Ask me a practice question to test my understanding',
  ];

  useEffect(() => {
    // Scroll to bottom on message change
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isSending]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setInputText('');
    await sendMessage(text, currentMaterial);
  };

  const toggleExpandSource = (msgId: string) => {
    setExpandedSourceMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const getLanguageLabel = (lang: ChatLanguage): string => {
    switch (lang) {
      case 'roman_urdu':
        return 'Roman Urdu';
      case 'urdu':
        return 'اردو';
      case 'en':
      default:
        return 'English';
    }
  };

  const cycleLanguage = () => {
    if (chatLanguage === 'en') setChatLanguage('roman_urdu');
    else if (chatLanguage === 'roman_urdu') setChatLanguage('urdu');
    else setChatLanguage('en');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Header */}
        <Header
          title="Study Chat"
          subtitle="Grounded Q&A with your materials"
          rightAction={
            <TouchableOpacity
              style={[styles.langSwitchPill, { backgroundColor: colors.primaryContainer }]}
              onPress={cycleLanguage}
              activeOpacity={0.75}
            >
              <Ionicons name="language" size={15} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.langSwitchText, { color: colors.primary }]}>
                {getLanguageLabel(chatLanguage)}
              </Text>
            </TouchableOpacity>
          }
        />

        {/* Material Selection Horizontal Selector */}
        <View style={[styles.selectorBarWrapper, { borderBottomColor: colors.borderSubtle }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorScroll}
          >
            {materials.length === 0 ? (
              <View style={[styles.docChip, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.docChipText, { color: colors.textSecondary }]}>
                  Upload materials to enable document grounding
                </Text>
              </View>
            ) : (
              materials.map((mat) => {
                const isSelected = (currentMaterial?.id || '') === mat.id;
                return (
                  <TouchableOpacity
                    key={mat.id}
                    style={[
                      styles.docChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                        borderColor: isSelected ? colors.primary : colors.borderSubtle,
                      },
                    ]}
                    onPress={() => {
                      setSelectedMaterialId(mat.id);
                      setActiveMaterial(mat);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'document-text-outline'}
                      size={14}
                      color={isSelected ? colors.onPrimary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.docChipText,
                        {
                          color: isSelected ? colors.onPrimary : colors.textPrimary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {mat.title}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {messages.length > 1 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => clearChat(currentMaterial?.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Context Banner */}
          {currentMaterial && (
            <View style={[styles.groundingNotice, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="shield-checkmark" size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.groundingNoticeText, { color: colors.textSecondary }]}>
                Grounded in <Text style={{ fontWeight: '700', color: colors.primary }}>{currentMaterial.title}</Text> ({currentMaterial.wordCount} words)
              </Text>
            </View>
          )}

          {/* Messages */}
          {messages.map((msg: ChatMessage) => {
            const isUser = msg.sender === 'user';
            const isExpanded = expandedSourceMap[msg.id] || false;
            const hasSources = msg.sources && msg.sources.length > 0;

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.userMessageRow : styles.aiMessageRow,
                ]}
              >
                {!isUser && (
                  <View style={[styles.aiAvatar, { backgroundColor: colors.primaryContainer }]}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                  </View>
                )}

                <View style={styles.bubbleCol}>
                  <View
                    style={[
                      styles.bubble,
                      isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                        : [
                            styles.aiBubble,
                            {
                              backgroundColor: colors.surface,
                              borderColor: colors.borderSubtle,
                            },
                          ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        {
                          color: isUser ? colors.onPrimary : colors.textPrimary,
                          textAlign: msg.language === 'urdu' ? 'right' : 'left',
                        },
                      ]}
                    >
                      {msg.text}
                    </Text>

                    <Text
                      style={[
                        styles.timeText,
                        {
                          color: isUser ? 'rgba(255, 255, 255, 0.7)' : colors.textTertiary,
                          textAlign: isUser ? 'right' : 'left',
                        },
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>

                  {/* Grounded Source Citations Accordion */}
                  {!isUser && hasSources && (
                    <View style={styles.sourcesContainer}>
                      <TouchableOpacity
                        style={[
                          styles.sourceToggleButton,
                          { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle },
                        ]}
                        onPress={() => toggleExpandSource(msg.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="bookmark" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.sourceToggleText, { color: colors.primary }]}>
                          {isExpanded
                            ? `Hide ${msg.sources!.length} Grounded Excerpts`
                            : `View ${msg.sources!.length} Source Citations`}
                        </Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={colors.primary}
                          style={{ marginLeft: 4 }}
                        />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={[styles.sourceDrawer, { backgroundColor: colors.surfaceSubtle }]}>
                          {msg.sources!.map((source, sIdx) => (
                            <View key={`src_${sIdx}`} style={styles.sourceItem}>
                              <View style={styles.sourceItemHeader}>
                                <Badge
                                  label={`Excerpt ${source.chunkIndex}`}
                                  variant="sage"
                                />
                                <Text style={[styles.sourceScoreText, { color: colors.textTertiary }]}>
                                  Score: {source.score.toFixed(1)}
                                </Text>
                              </View>
                              <Text style={[styles.sourceItemText, { color: colors.textSecondary }]}>
                                "{source.textSnippet.trim()}"
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {/* Typing / Processing Indicator */}
          {isSending && (
            <View style={[styles.messageRow, styles.aiMessageRow]}>
              <View style={[styles.aiAvatar, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <View
                style={[
                  styles.bubble,
                  styles.aiBubble,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                  },
                ]}
              >
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: spacing.sm }} />
                  <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>
                    CampusMind is referencing your lecture...
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Suggested Prompt Chips (displayed when conversation is new) */}
          {messages.length <= 2 && !isSending && (
            <View style={styles.promptsSection}>
              <Text style={[styles.promptsHeader, { color: colors.textTertiary }]}>
                SUGGESTED QUESTIONS
              </Text>
              <View style={styles.promptsGrid}>
                {suggestedPrompts.map((prompt, pIdx) => (
                  <TouchableOpacity
                    key={`prompt_${pIdx}`}
                    style={[
                      styles.promptChip,
                      { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
                    ]}
                    onPress={() => handleSend(prompt)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.promptChipText, { color: colors.textPrimary }]}>
                      {prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderSubtle,
            },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surfaceSubtle,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              },
            ]}
            placeholder={
              currentMaterial
                ? `Ask about ${currentMaterial.title}...`
                : 'Ask CampusMind anything...'
            }
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={600}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  inputText.trim().length > 0 && !isSending
                    ? colors.primary
                    : colors.surfaceSubtle,
              },
            ]}
            onPress={() => handleSend()}
            disabled={inputText.trim().length === 0 || isSending}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={
                inputText.trim().length > 0 && !isSending
                  ? colors.onPrimary
                  : colors.textTertiary
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  langSwitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  langSwitchText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  selectorBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
  },
  selectorScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 6,
    maxWidth: 240,
  },
  docChipText: {
    ...typography.presets.caption,
    fontSize: 12,
  },
  clearBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  messageList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  groundingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  groundingNoticeText: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  bubbleCol: {
    maxWidth: '82%',
  },
  bubble: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    borderTopRightRadius: 4,
    marginLeft: spacing.xl,
  },
  aiBubble: {
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    ...typography.presets.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  timeText: {
    ...typography.presets.caption,
    fontSize: 10,
    marginTop: 4,
  },
  sourcesContainer: {
    marginTop: spacing.xs,
  },
  sourceToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginTop: 2,
  },
  sourceToggleText: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  sourceDrawer: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  sourceItem: {
    paddingBottom: spacing.xs,
  },
  sourceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sourceScoreText: {
    ...typography.presets.caption,
    fontSize: 10,
  },
  sourceItemText: {
    ...typography.presets.caption,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thinkingText: {
    ...typography.presets.caption,
    fontSize: 13,
  },
  promptsSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  promptsHeader: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  promptsGrid: {
    gap: spacing.sm,
  },
  promptChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  promptChipText: {
    ...typography.presets.bodySmall,
    fontSize: 13,
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
});
