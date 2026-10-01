import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useContentStore } from '../store/useContentStore';
import { typography } from '../theme/typography';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { StudyMaterial } from '../types/content';
import { triggerHaptic } from '../services/haptics';
import { showThemedAlert, showThemedToast } from '../store/useNotificationStore';
import { RichMarkdown } from './RichMarkdown';
import { isTextReadable } from '../utils/textQuality';

interface EditMaterialModalProps {
  visible: boolean;
  onClose: () => void;
  material: StudyMaterial;
  onSuccess?: (newMaterial: StudyMaterial) => void;
}

export const EditMaterialModal: React.FC<EditMaterialModalProps> = ({
  visible,
  onClose,
  material,
  onSuccess,
}) => {
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const addCustomSubject = useAuthStore((state) => state.addCustomSubject);
  const updateMaterialContent = useContentStore((state) => state.updateMaterialContent);
  const materials = useContentStore((state) => state.materials);

  const [title, setTitle] = useState(material.title || 'Untitled Material');
  const [subject, setSubject] = useState(material.subject || 'General Studies');
  const [text, setText] = useState(material.extractedText || '');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Custom subject adding state
  const [isAddingCustomSubject, setIsAddingCustomSubject] = useState(false);
  const [customSubjectText, setCustomSubjectText] = useState('');

  const inputRef = useRef<TextInput>(null);

  // Collect all known subjects
  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    if (material.subject) set.add(material.subject);
    set.add('General Studies');
    set.add('Computer Science');
    set.add('Biology');
    set.add('History');
    (user?.customSubjects || []).forEach((s) => set.add(s));
    materials.forEach((m) => {
      if (m.subject) set.add(m.subject);
    });
    return Array.from(set);
  }, [material.subject, user?.customSubjects, materials]);

  const wordCount = useMemo(() => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [text]);

  const qualityCheck = useMemo(() => {
    return isTextReadable(text);
  }, [text]);

  // Insert formatting snippet at cursor
  const handleInsertSnippet = (before: string, after: string = '', placeholder: string = '') => {
    triggerHaptic('selection');
    const start = selection.start;
    const end = selection.end;
    const selectedText = text.substring(start, end) || placeholder;

    const newText =
      text.substring(0, start) +
      before +
      selectedText +
      after +
      text.substring(end);

    setText(newText);
    const newCursor = start + before.length + selectedText.length + after.length;
    setTimeout(() => {
      setSelection({ start: newCursor, end: newCursor });
    }, 50);
  };

  const handleInsertTable = () => {
    triggerHaptic('selection');
    const tableSnippet =
      '\n\n| Item | Value | Description |\n| :--- | :--- | :--- |\n| Sample A | 100 | Key observation |\n| Sample B | 250 | Secondary note |\n\n';
    handleInsertSnippet(tableSnippet);
  };

  const handleSaveCustomSubject = async () => {
    const trimmed = customSubjectText.trim();
    if (!trimmed) {
      setIsAddingCustomSubject(false);
      return;
    }
    await addCustomSubject(trimmed);
    setSubject(trimmed);
    setIsAddingCustomSubject(false);
    setCustomSubjectText('');
    triggerHaptic('selection');
  };

  const handleSaveAndIngest = async () => {
    const cleanText = text.trim();
    if (cleanText.length < 20) {
      triggerHaptic('errorNotification');
      showThemedAlert(
        'Content Too Short',
        'Study material must contain at least 20 readable characters.'
      );
      return;
    }

    if (!qualityCheck.readable) {
      triggerHaptic('errorNotification');
      showThemedAlert(
        'Quality Warning',
        qualityCheck.reason || 'The text contains unreadable characters.'
      );
      return;
    }

    const cleanTitle = title.trim() || material.title || 'Untitled Material';
    const cleanSubject = subject.trim() || 'General Studies';

    setIsSaving(true);
    triggerHaptic('lightImpact');

    try {
      const updatedMaterial = await updateMaterialContent(material.id, {
        title: cleanTitle,
        subject: cleanSubject,
        extractedText: cleanText,
        wordCount,
      });

      triggerHaptic('successNotification');
      showThemedToast('success', `Saved changes to "${cleanTitle}"!`);

      onClose();
      if (onSuccess) {
        onSuccess(updatedMaterial);
      }
    } catch (err: any) {
      triggerHaptic('errorNotification');
      showThemedAlert(
        'Save Failed',
        err.message || 'Could not save your changes. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header Bar */}
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.borderSubtle,
              paddingTop: Math.max(insets.top, spacing.md),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surfaceSubtle }]}
            onPress={onClose}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Edit Study Content
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Save updates in-place
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: isSaving ? colors.surfaceSubtle : colors.primary },
            ]}
            onPress={handleSaveAndIngest}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Title Input & Subject Row */}
        <View style={[styles.metaSection, { borderBottomColor: colors.borderSubtle }]}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>MATERIAL TITLE</Text>
          <TextInput
            style={[
              styles.titleInput,
              {
                backgroundColor: colors.surfaceSubtle,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Material Title"
            placeholderTextColor={colors.textTertiary}
            editable={!isSaving}
          />

          {/* Subject Pills */}
          <View style={styles.subjectRowHeader}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>COURSE / SUBJECT</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectScroll}
          >
            {allSubjects.map((s) => {
              const isSelected = subject === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                      borderColor: isSelected ? colors.primary : colors.borderSubtle,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSubject(s);
                  }}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.subjectChipText,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {!isAddingCustomSubject ? (
              <TouchableOpacity
                style={[styles.subjectChip, styles.addSubjectChip, { borderColor: colors.primary }]}
                onPress={() => setIsAddingCustomSubject(true)}
                disabled={isSaving}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={[styles.subjectChipText, { color: colors.primary, marginLeft: 2 }]}>
                  Other
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.customSubjectInputRow}>
                <TextInput
                  style={[
                    styles.customSubjectInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      borderColor: colors.primary,
                    },
                  ]}
                  placeholder="Subject name"
                  placeholderTextColor={colors.textTertiary}
                  value={customSubjectText}
                  onChangeText={setCustomSubjectText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveCustomSubject}
                />
                <TouchableOpacity
                  style={[styles.customSubjectAddBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveCustomSubject}
                >
                  <Text style={styles.customSubjectAddBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Segmented Mode Switcher: Edit vs Preview */}
        <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle }]}>
          <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <TouchableOpacity
              style={[
                styles.segmentTab,
                activeTab === 'edit' && [styles.segmentTabActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab('edit');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={activeTab === 'edit' ? colors.primary : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  { color: activeTab === 'edit' ? colors.primary : colors.textSecondary },
                ]}
              >
                Edit Content
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentTab,
                activeTab === 'preview' && [styles.segmentTabActive, { backgroundColor: colors.surface }],
              ]}
              onPress={() => {
                triggerHaptic('selection');
                setActiveTab('preview');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="eye-outline"
                size={15}
                color={activeTab === 'preview' ? colors.primary : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.segmentTabText,
                  { color: activeTab === 'preview' ? colors.primary : colors.textSecondary },
                ]}
              >
                Preview ({wordCount} words)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Formatting Toolbar (Only in Edit mode) */}
        {activeTab === 'edit' && (
          <View style={[styles.formatToolbar, { backgroundColor: colors.surfaceSubtle, borderBottomColor: colors.borderSubtle }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('# ', '', 'Heading 1')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toolChipText, { color: colors.textPrimary, fontWeight: '700' }]}>H1</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('## ', '', 'Heading 2')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toolChipText, { color: colors.textPrimary, fontWeight: '700' }]}>H2</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('**', '**', 'bold text')}
                activeOpacity={0.7}
              >
                <Ionicons name="text-outline" size={14} color={colors.textPrimary} />
                <Text style={[styles.toolChipText, { color: colors.textPrimary, fontWeight: '700', marginLeft: 2 }]}>B</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('*', '*', 'italic text')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toolChipText, { color: colors.textPrimary, fontStyle: 'italic' }]}>I</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('- ', '', 'Bullet item')}
                activeOpacity={0.7}
              >
                <Ionicons name="list-outline" size={14} color={colors.textPrimary} />
                <Text style={[styles.toolChipText, { color: colors.textPrimary, marginLeft: 3 }]}>Bullets</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('1. ', '', 'Numbered item')}
                activeOpacity={0.7}
              >
                <Ionicons name="reorder-four-outline" size={14} color={colors.textPrimary} />
                <Text style={[styles.toolChipText, { color: colors.textPrimary, marginLeft: 3 }]}>Numbered</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={handleInsertTable}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={14} color={colors.primary} />
                <Text style={[styles.toolChipText, { color: colors.primary, fontWeight: '700', marginLeft: 3 }]}>
                  Table
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, { backgroundColor: colors.surface }]}
                onPress={() => handleInsertSnippet('> ', '', 'Quoted note')}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.textPrimary} />
                <Text style={[styles.toolChipText, { color: colors.textPrimary, marginLeft: 3 }]}>Quote</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Content Body */}
        <View style={styles.bodyContainer}>
          {activeTab === 'edit' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.massive }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <TextInput
                ref={inputRef}
                style={[
                  styles.editorInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.background,
                  },
                ]}
                multiline
                textAlignVertical="top"
                value={text}
                onChangeText={setText}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                placeholder="Paste or write study notes, headings, tables (| Col 1 | Col 2 |), and lists (- bullet, 1. numbered) here..."
                placeholderTextColor={colors.textTertiary}
                editable={!isSaving}
                autoCorrect={false}
                autoCapitalize="sentences"
              />
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.previewContainer}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.massive }}
              showsVerticalScrollIndicator={true}
            >
              {text.trim().length > 0 ? (
                <RichMarkdown content={text} />
              ) : (
                <Text style={[styles.emptyPreviewText, { color: colors.textTertiary }]}>
                  No content written yet. Switch to Edit tab to add text.
                </Text>
              )}
            </ScrollView>
          )}
        </View>

        {/* Footer Statistics Bar */}
        <View
          style={[
            styles.footerBar,
            {
              borderTopColor: colors.borderSubtle,
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, spacing.sm),
            },
          ]}
        >
          <View style={styles.footerStatItem}>
            <Ionicons name="document-text-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.footerStatText, { color: colors.textSecondary }]}>
              {wordCount} words
            </Text>
          </View>

          <View style={styles.footerStatItem}>
            <View
              style={[
                styles.qualityDot,
                { backgroundColor: qualityCheck.readable ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text
              style={[
                styles.footerStatText,
                { color: qualityCheck.readable ? colors.textSecondary : '#EF4444' },
              ]}
            >
              {qualityCheck.readable ? 'Valid Study Quality' : qualityCheck.reason || 'Unreadable'}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    maxWidth: '60%',
  },
  headerTitle: {
    ...typography.presets.titleSmall,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    ...typography.presets.caption,
    fontSize: 11,
    marginTop: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  saveBtnText: {
    ...typography.presets.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  metaSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.presets.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  titleInput: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.xs,
  },
  subjectRowHeader: {
    marginTop: 2,
  },
  subjectScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
  },
  subjectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  addSubjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  subjectChipText: {
    ...typography.presets.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  customSubjectInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  customSubjectInput: {
    ...typography.presets.caption,
    fontSize: 12,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    minWidth: 100,
  },
  customSubjectAddBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  customSubjectAddBtnText: {
    ...typography.presets.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  tabBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
  },
  segmentTabActive: {
    ...shadows.subtle,
  },
  segmentTabText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  formatToolbar: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
  },
  toolbarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    minWidth: 32,
  },
  toolChipText: {
    ...typography.presets.caption,
    fontSize: 12,
  },
  bodyContainer: {
    flex: 1,
  },
  editorInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.presets.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
  previewContainer: {
    flex: 1,
  },
  emptyPreviewText: {
    ...typography.presets.bodySmall,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontStyle: 'italic',
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  footerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerStatText: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  qualityDot: {
    width: 7,
    height: 7,
    borderRadius: borderRadius.full,
  },
});
