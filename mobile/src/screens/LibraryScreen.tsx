import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useContentStore } from '../store/useContentStore';
import { showThemedAlert } from '../store/useNotificationStore';
import { ContentType, StudyMaterial } from '../types/content';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { IngestionModal } from '../components/IngestionModal';
import { isDueForReview, getReviewBadge } from '../services/spacedRepetition';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

type LibraryTab = 'all' | 'folders' | 'reviews';

interface SubjectGroup {
  subject: string;
  materials: StudyMaterial[];
  dueCount: number;
  quizCount: number;
}

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useThemeStore();
  const user = useAuthStore((state) => state.user);
  const { materials, deleteMaterial, setActiveMaterial } = useContentStore();

  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Filtered materials by search query and active subject filter
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject =
        selectedSubjectFilter === null ||
        item.subject.toLowerCase() === selectedSubjectFilter.toLowerCase();

      return matchesSearch && matchesSubject;
    });
  }, [materials, searchQuery, selectedSubjectFilter]);

  // Group materials by subject for Folders view
  const subjectGroups = useMemo((): SubjectGroup[] => {
    const map: Record<string, StudyMaterial[]> = {};
    materials.forEach((item) => {
      const subj = item.subject || 'General Studies';
      if (!map[subj]) map[subj] = [];
      map[subj].push(item);
    });

    return Object.keys(map).map((subj) => ({
      subject: subj,
      materials: map[subj],
      dueCount: map[subj].filter((m) => isDueForReview(m)).length,
      quizCount: map[subj].filter((m) => m.quiz && m.quiz.length > 0).length,
    }));
  }, [materials]);

  // Items due for spaced repetition review
  const dueMaterials = useMemo(() => {
    return materials.filter((item) => isDueForReview(item));
  }, [materials]);

  const getBadgeDetails = (type: ContentType) => {
    switch (type) {
      case 'youtube':
        return { label: 'YouTube Video', variant: 'peach' as const };
      case 'audio':
        return { label: 'Audio Lecture', variant: 'lavender' as const };
      case 'ocr':
        return { label: 'Handwritten Notes', variant: 'sky' as const };
      case 'pdf':
      default:
        return { label: 'PDF Document', variant: 'sage' as const };
    }
  };

  const getSubjectColor = (idx: number) => {
    const palette = [
      { bg: colors.primaryContainer, text: colors.primary },
      { bg: colors.lavenderContainer, text: colors.lavender },
      { bg: colors.peachContainer, text: colors.peach },
      { bg: colors.skyContainer, text: colors.sky },
      { bg: colors.amberContainer, text: colors.amber },
    ];
    return palette[idx % palette.length];
  };

  const handleDelete = (item: StudyMaterial) => {
    showThemedAlert(
      'Delete Material',
      `Are you sure you want to remove "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const userId = user?.uid || 'guest_user';
            await deleteMaterial(item.id, userId);
            showThemedAlert('Deleted', `"${item.title}" has been removed.`);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Header
        title="Library"
        subtitle="Organized study notes & revision schedule"
        rightAction={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primaryContainer }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search notes, subjects, or keywords..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* View Mode Segment Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surfaceSubtle }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'all' && [styles.activeTabItem, { backgroundColor: colors.surface }],
          ]}
          onPress={() => {
            setActiveTab('all');
            setSelectedSubjectFilter(null);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="documents-outline"
            size={16}
            color={activeTab === 'all' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'all' ? colors.primary : colors.textSecondary },
            ]}
          >
            All Notes ({materials.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'folders' && [styles.activeTabItem, { backgroundColor: colors.surface }],
          ]}
          onPress={() => setActiveTab('folders')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="folder-outline"
            size={16}
            color={activeTab === 'folders' ? colors.primary : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'folders' ? colors.primary : colors.textSecondary },
            ]}
          >
            Folders ({subjectGroups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'reviews' && [styles.activeTabItem, { backgroundColor: colors.surface }],
          ]}
          onPress={() => {
            setActiveTab('reviews');
            setSelectedSubjectFilter(null);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="alarm-outline"
            size={16}
            color={activeTab === 'reviews' ? colors.peach : colors.textSecondary}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'reviews' ? colors.peach : colors.textSecondary },
            ]}
          >
            Due ({dueMaterials.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Subject Filter Banner (if filtering by folder) */}
      {selectedSubjectFilter && (
        <View style={[styles.filterBanner, { backgroundColor: colors.primaryContainer }]}>
          <Text style={[styles.filterBannerText, { color: colors.primary }]}>
            Filtered by: <Text style={{ fontWeight: '700' }}>{selectedSubjectFilter}</Text>
          </Text>
          <TouchableOpacity onPress={() => setSelectedSubjectFilter(null)} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* 1. SUBJECT FOLDERS TAB */}
      {activeTab === 'folders' && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {subjectGroups.length === 0 ? (
            <Card variant="surface" style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.lavenderContainer }]}>
                <Ionicons name="folder-open-outline" size={36} color={colors.lavender} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Folders Yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                Upload your course lectures or notes to automatically create subject folders.
              </Text>
            </Card>
          ) : (
            subjectGroups.map((group, idx) => {
              const colorTheme = getSubjectColor(idx);
              return (
                <TouchableOpacity
                  key={group.subject}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedSubjectFilter(group.subject);
                    setActiveTab('all');
                  }}
                >
                  <Card variant="surface" style={styles.folderCard}>
                    <View style={styles.folderHeader}>
                      <View style={[styles.folderIconBadge, { backgroundColor: colorTheme.bg }]}>
                        <Ionicons name="folder" size={24} color={colorTheme.text} />
                      </View>
                      <View style={styles.folderInfo}>
                        <Text style={[styles.folderTitle, { color: colors.textPrimary }]}>
                          {group.subject}
                        </Text>
                        <Text style={[styles.folderCount, { color: colors.textSecondary }]}>
                          {group.materials.length} {group.materials.length === 1 ? 'item' : 'items'}
                          {group.quizCount > 0 ? ` • ${group.quizCount} quizzes` : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </View>

                    {/* Folder Status Badges */}
                    <View style={styles.folderFooter}>
                      {group.dueCount > 0 ? (
                        <View style={[styles.statusMiniBadge, { backgroundColor: colors.peachContainer }]}>
                          <Ionicons name="alarm-outline" size={12} color={colors.peach} />
                          <Text style={[styles.statusMiniText, { color: colors.peach }]}>
                            {group.dueCount} Due for Spaced Review
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.statusMiniBadge, { backgroundColor: colors.primaryContainer }]}>
                          <Ionicons name="checkmark-circle-outline" size={12} color={colors.primary} />
                          <Text style={[styles.statusMiniText, { color: colors.primary }]}>
                            All caught up
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* 2. DUE FOR REVISION TAB */}
      {activeTab === 'reviews' && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {dueMaterials.length === 0 ? (
            <Card variant="surface" style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="checkmark-done" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                You're All Caught Up! 🌟
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                No materials are due for spaced repetition right now. Excellent work staying on top of your coursework!
              </Text>
            </Card>
          ) : (
            dueMaterials.map((item) => {
              const badge = getBadgeDetails(item.type);
              const reviewBadge = getReviewBadge(item);

              return (
                <Card key={item.id} variant="surface" style={styles.reviewCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.badgeRow}>
                      <Badge label={reviewBadge.label} variant={reviewBadge.variant} />
                      <Badge label={item.subject} variant="sky" />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                    {item.title}
                  </Text>

                  <Text style={[styles.itemSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.summary?.overview || item.extractedText.substring(0, 160)}
                  </Text>

                  {/* Review Stats */}
                  <View style={[styles.scheduleStatsBar, { backgroundColor: colors.surfaceSubtle }]}>
                    <Text style={[styles.scheduleStatText, { color: colors.textSecondary }]}>
                      Interval: <Text style={{ fontWeight: '700' }}>{item.reviewIntervalDays || 1}d</Text>
                    </Text>
                    <Text style={[styles.scheduleStatText, { color: colors.textSecondary }]}>
                      Recall: <Text style={{ fontWeight: '700' }}>{item.lastReviewScore ? `${item.lastReviewScore}%` : 'New'}</Text>
                    </Text>
                    <Text style={[styles.scheduleStatText, { color: colors.textSecondary }]}>
                      Level: <Text style={{ fontWeight: '700' }}>{item.repetitionNumber || 0}</Text>
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      style={[styles.reviewActionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        setActiveMaterial(item);
                        navigation.navigate('Quiz', { materialId: item.id });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="help-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.reviewActionBtnText}>Practice Spaced Quiz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.reviewSummaryBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}
                      onPress={() => {
                        setActiveMaterial(item);
                        navigation.navigate('Summary', { materialId: item.id });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="book-outline" size={16} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      {/* 3. ALL MATERIALS TAB */}
      {activeTab === 'all' && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {filteredMaterials.length === 0 ? (
            <Card variant="surface" style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="book-outline" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {searchQuery ? 'No Matching Materials' : 'Your Library is Empty'}
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                {searchQuery
                  ? 'Try adjusting your search terms or clearing the subject filter.'
                  : 'Add your lecture notes, PDFs, audio recordings, or YouTube videos to get started.'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color={colors.onPrimary} />
                  <Text style={[styles.emptyAddText, { color: colors.onPrimary }]}>Add Material</Text>
                </TouchableOpacity>
              )}
            </Card>
          ) : (
            filteredMaterials.map((item) => {
              const badge = getBadgeDetails(item.type);
              const reviewBadge = getReviewBadge(item);
              const estReadMinutes = Math.max(1, Math.round(item.wordCount / 180));

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setActiveMaterial(item);
                    navigation.navigate('Summary', { materialId: item.id });
                  }}
                >
                  <Card variant="surface" style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.badgeRow}>
                        <Badge label={badge.label} variant={badge.variant} />
                        <Badge label={reviewBadge.label} variant={reviewBadge.variant} />
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      {item.title}
                    </Text>

                    <Text
                      style={[styles.itemSnippet, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {item.summary?.overview || item.extractedText.substring(0, 160)}
                    </Text>

                    <View style={styles.cardFooter}>
                      <View style={styles.metaCol}>
                        <Text style={[styles.subjectTag, { color: colors.primary }]}>
                          {item.subject}
                        </Text>
                        <Text style={[styles.itemMeta, { color: colors.textTertiary }]}>
                          ~{estReadMinutes} min read ({item.wordCount} words)
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Ingestion Modal */}
      <IngestionModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    padding: 3,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  activeTabItem: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    ...typography.presets.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  filterBannerText: {
    ...typography.presets.caption,
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.massive,
    gap: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  itemTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    marginBottom: spacing.xs,
    fontSize: 16,
  },
  itemSnippet: {
    ...typography.presets.bodySmall,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: spacing.sm,
  },
  metaCol: {
    gap: 2,
  },
  subjectTag: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  itemMeta: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  // Folder card styles
  folderCard: {
    marginBottom: spacing.xs,
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  folderIconBadge: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  folderInfo: {
    flex: 1,
  },
  folderTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
  },
  folderCount: {
    ...typography.presets.caption,
    fontSize: 12,
  },
  folderFooter: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: spacing.sm,
  },
  statusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statusMiniText: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  // Review Card styles
  reviewCard: {
    marginBottom: spacing.sm,
  },
  scheduleStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  scheduleStatText: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.full,
  },
  reviewActionBtnText: {
    ...typography.presets.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  reviewSummaryBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  // Empty states
  emptyCard: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.presets.headline,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyDesc: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  emptyAddText: {
    ...typography.presets.labelLarge,
    fontWeight: '700',
  },
});
