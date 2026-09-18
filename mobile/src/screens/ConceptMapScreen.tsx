import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText, G, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useContentStore } from '../store/useContentStore';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { ConceptNode, ConceptEdge, ConceptMapData, StudyMaterial } from '../types/content';

interface ConceptMapScreenProps {
  onBack: () => void;
  materialId?: string;
  onNavigateToChat?: () => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CANVAS_WIDTH = 750;
const CANVAS_HEIGHT = 650;

export const ConceptMapScreen: React.FC<ConceptMapScreenProps> = ({
  onBack,
  materialId,
  onNavigateToChat,
}) => {
  const { colors, isDark } = useThemeStore();
  const { user } = useAuthStore();
  const {
    activeMaterial,
    materials,
    isGeneratingConceptMap,
    generateConceptMapForMaterial,
  } = useContentStore();

  const currentMaterial = materialId
    ? materials.find((m) => m.id === materialId) || activeMaterial
    : activeMaterial;

  const [conceptMap, setConceptMap] = useState<ConceptMapData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  useEffect(() => {
    loadOrGenerateMap();
  }, [currentMaterial?.id]);

  const loadOrGenerateMap = async () => {
    if (!currentMaterial) return;

    if (currentMaterial.conceptMap && currentMaterial.conceptMap.nodes.length > 0) {
      setConceptMap(currentMaterial.conceptMap);
      setSelectedNodeId(currentMaterial.conceptMap.nodes[0]?.id || null);
      return;
    }

    if (user?.uid) {
      setIsLocalLoading(true);
      try {
        const generated = await generateConceptMapForMaterial(currentMaterial.id, user.uid);
        setConceptMap(generated);
        if (generated.nodes.length > 0) {
          setSelectedNodeId(generated.nodes[0].id);
        }
      } catch (err) {
        console.error('Failed to generate concept map:', err);
      } finally {
        setIsLocalLoading(false);
      }
    }
  };

  // Node category colors
  const getCategoryStyles = (category: ConceptNode['category']) => {
    switch (category) {
      case 'root':
        return {
          bg: colors.primaryContainer,
          text: colors.primary,
          border: colors.primary,
          dot: colors.primary,
        };
      case 'core':
        return {
          bg: colors.lavenderContainer,
          text: colors.lavender,
          border: colors.lavender,
          dot: colors.lavender,
        };
      case 'mechanism':
        return {
          bg: colors.peachContainer,
          text: colors.peach,
          border: colors.peach,
          dot: colors.peach,
        };
      case 'application':
        return {
          bg: colors.skyContainer,
          text: colors.sky,
          border: colors.sky,
          dot: colors.sky,
        };
      case 'example':
      default:
        return {
          bg: colors.amberContainer,
          text: colors.amber,
          border: colors.amber,
          dot: colors.amber,
        };
    }
  };

  // Compute node layouts deterministically across tiers
  const nodePositions = useMemo(() => {
    const positions: Record<string, NodePosition> = {};
    if (!conceptMap || conceptMap.nodes.length === 0) return positions;

    const nodes = conceptMap.nodes;
    const root = nodes.find((n) => n.category === 'root') || nodes[0];
    const nonRoot = nodes.filter((n) => n.id !== root.id);

    // Root node at top center
    positions[root.id] = {
      x: CANVAS_WIDTH / 2,
      y: 70,
      width: 170,
      height: 54,
    };

    // Divide remaining nodes into 2 or 3 tiers
    const tier1Count = Math.min(3, Math.ceil(nonRoot.length / 2));
    const tier1 = nonRoot.slice(0, tier1Count);
    const tier2 = nonRoot.slice(tier1Count);

    // Tier 1 coordinates
    tier1.forEach((node, idx) => {
      const step = CANVAS_WIDTH / (tier1.length + 1);
      positions[node.id] = {
        x: step * (idx + 1),
        y: 220,
        width: 144,
        height: 50,
      };
    });

    // Tier 2 coordinates
    tier2.forEach((node, idx) => {
      const step = CANVAS_WIDTH / (tier2.length + 1);
      positions[node.id] = {
        x: step * (idx + 1),
        y: 380,
        width: 144,
        height: 50,
      };
    });

    return positions;
  }, [conceptMap]);

  const selectedNode = conceptMap?.nodes.find((n) => n.id === selectedNodeId);

  // Connected edges for the selected node
  const connectedEdges = useMemo(() => {
    if (!conceptMap || !selectedNodeId) return [];
    return conceptMap.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );
  }, [conceptMap, selectedNodeId]);

  const handleAskInChat = () => {
    if (!selectedNode || !currentMaterial) return;
    const chatStore = useChatStore.getState();
    chatStore.setSelectedMaterialId(currentMaterial.id);
    if (onNavigateToChat) {
      onNavigateToChat();
    }
  };

  // 1. Loading State
  if (isGeneratingConceptMap || isLocalLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.centerContainer}>
          <View style={[styles.loadingBadge, { backgroundColor: colors.skyContainer }]}>
            <Ionicons name="git-network-outline" size={34} color={colors.sky} />
          </View>
          <Text style={[styles.loadingHeader, { color: colors.textPrimary }]}>
            Mapping Concepts
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
            CampusMind AI is analyzing structural dependencies, mechanisms, and key terms in{' '}
            {currentMaterial?.title || 'your lecture'}...
          </Text>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  // 2. Empty State
  if (!conceptMap || conceptMap.nodes.length === 0) {
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
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>Concept Map</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centerContainer}>
          <View style={[styles.loadingBadge, { backgroundColor: colors.lavenderContainer }]}>
            <Ionicons name="git-merge-outline" size={34} color={colors.lavender} />
          </View>
          <Text style={[styles.loadingHeader, { color: colors.textPrimary }]}>
            No Map Generated Yet
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
            Generate an interactive visual concept graph to grasp relationships at a glance.
          </Text>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: colors.primary, marginTop: spacing.xl }]}
            onPress={loadOrGenerateMap}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: spacing.xs }} />
            <Text style={styles.primaryActionBtnText}>Generate Concept Map</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const lineStrokeColor = isDark ? '#3F3F46' : '#D1D5DB';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surfaceSubtle }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerInfoCenter}>
          <Text style={[styles.headerSubjectBadge, { color: colors.primary }]}>
            {currentMaterial?.subject || 'Concept Graph'}
          </Text>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {currentMaterial?.title || 'Knowledge Map'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.surfaceSubtle }]}
          onPress={loadOrGenerateMap}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Category Legend Bar */}
      <View style={[styles.legendBar, { backgroundColor: colors.surfaceSubtle, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Root</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.lavender }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Core</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.peach }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Mechanism</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.sky }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Application</Text>
        </View>
      </View>

      {/* 2D Pannable & Scrollable SVG Concept Canvas */}
      <View style={styles.canvasContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.canvasHorizontalScroll}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.canvasVerticalScroll}
          >
            <View style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
              <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={StyleSheet.absoluteFill}>
                {/* 1. Render connecting relationship edges */}
                {conceptMap.edges.map((edge, eIdx) => {
                  const src = nodePositions[edge.source];
                  const tgt = nodePositions[edge.target];
                  if (!src || !tgt) return null;

                  const isConnectedToSelected =
                    selectedNodeId === edge.source || selectedNodeId === edge.target;

                  // Edge midpoint for relationship label
                  const midX = (src.x + tgt.x) / 2;
                  const midY = (src.y + tgt.y) / 2;

                  return (
                    <G key={`edge_${eIdx}`}>
                      <Line
                        x1={src.x}
                        y1={src.y + src.height / 2}
                        x2={tgt.x}
                        y2={tgt.y - tgt.height / 2}
                        stroke={isConnectedToSelected ? colors.primary : lineStrokeColor}
                        strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                        strokeDasharray={isConnectedToSelected ? undefined : '4,3'}
                      />
                      {/* Midpoint relationship pill */}
                      <Rect
                        x={midX - 38}
                        y={midY - 9}
                        width={76}
                        height={18}
                        rx={9}
                        fill={isDark ? '#262629' : '#FFFFFF'}
                        stroke={isConnectedToSelected ? colors.primary : colors.borderSubtle}
                        strokeWidth={1}
                      />
                      <SvgText
                        x={midX}
                        y={midY + 3.5}
                        fontSize={9}
                        fontWeight="600"
                        fill={isConnectedToSelected ? colors.primary : colors.textTertiary}
                        textAnchor="middle"
                      >
                        {edge.label}
                      </SvgText>
                    </G>
                  );
                })}

                {/* 2. Render concept nodes */}
                {conceptMap.nodes.map((node) => {
                  const pos = nodePositions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNodeId === node.id;
                  const catStyle = getCategoryStyles(node.category);

                  const nodeX = pos.x - pos.width / 2;
                  const nodeY = pos.y - pos.height / 2;

                  return (
                    <G
                      key={node.id}
                      onPress={() => setSelectedNodeId(node.id)}
                    >
                      {/* Selection glow ring */}
                      {isSelected && (
                        <Rect
                          x={nodeX - 4}
                          y={nodeY - 4}
                          width={pos.width + 8}
                          height={pos.height + 8}
                          rx={20}
                          fill="transparent"
                          stroke={colors.primary}
                          strokeWidth={2}
                          strokeOpacity={0.6}
                        />
                      )}

                      {/* Main Node Card */}
                      <Rect
                        x={nodeX}
                        y={nodeY}
                        width={pos.width}
                        height={pos.height}
                        rx={16}
                        fill={isSelected ? catStyle.bg : isDark ? '#232326' : '#FFFFFF'}
                        stroke={isSelected ? catStyle.border : colors.borderSubtle}
                        strokeWidth={isSelected ? 2 : 1}
                      />

                      {/* Category Dot */}
                      <Circle
                        cx={nodeX + 16}
                        cy={pos.y}
                        r={4}
                        fill={catStyle.dot}
                      />

                      {/* Node Label Text */}
                      <SvgText
                        x={pos.x + 4}
                        y={pos.y + 4}
                        fontSize={node.category === 'root' ? 12 : 11}
                        fontWeight={isSelected ? '700' : '600'}
                        fill={isSelected ? catStyle.text : colors.textPrimary}
                        textAnchor="middle"
                      >
                        {node.label}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* Interactive Concept Inspection Bottom Sheet */}
      {selectedNode && (
        <View
          style={[
            styles.inspectCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <View style={styles.inspectHeader}>
            <View style={styles.inspectTitleRow}>
              <View
                style={[
                  styles.categoryPill,
                  { backgroundColor: getCategoryStyles(selectedNode.category).bg },
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: getCategoryStyles(selectedNode.category).text },
                  ]}
                >
                  {selectedNode.category.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.inspectTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {selectedNode.label}
              </Text>
            </View>

            {onNavigateToChat && (
              <TouchableOpacity
                style={[styles.chatActionBtn, { backgroundColor: colors.primaryContainer }]}
                onPress={handleAskInChat}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubbles-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.chatActionBtnText, { color: colors.primary }]}>Ask in Chat</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.inspectDescription, { color: colors.textSecondary }]}>
            {selectedNode.description}
          </Text>

          {/* Connected Relationships list */}
          {connectedEdges.length > 0 && (
            <View style={styles.connectedRow}>
              <Text style={[styles.connectedLabel, { color: colors.textTertiary }]}>
                RELATIONSHIPS:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {connectedEdges.map((edge, idx) => {
                  const isSource = edge.source === selectedNode.id;
                  const otherNodeId = isSource ? edge.target : edge.source;
                  const otherNode = conceptMap.nodes.find((n) => n.id === otherNodeId);

                  return (
                    <TouchableOpacity
                      key={`rel_${idx}`}
                      style={[styles.relPill, { backgroundColor: colors.surfaceSubtle }]}
                      onPress={() => setSelectedNodeId(otherNodeId)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.relVerb, { color: colors.primary }]}>
                        {edge.label}
                      </Text>
                      <Ionicons
                        name={isSource ? 'arrow-forward' : 'arrow-back'}
                        size={10}
                        color={colors.textTertiary}
                      />
                      <Text style={[styles.relTarget, { color: colors.textPrimary }]} numberOfLines={1}>
                        {otherNode?.label || otherNodeId}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}
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
    borderBottomWidth: 1,
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
    fontSize: 11,
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
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  legendText: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  canvasContainer: {
    flex: 1,
  },
  canvasHorizontalScroll: {
    flexGrow: 1,
  },
  canvasVerticalScroll: {
    flexGrow: 1,
  },
  inspectCard: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  inspectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '68%',
  },
  categoryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  categoryPillText: {
    ...typography.presets.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  inspectTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    fontSize: 16,
  },
  chatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  chatActionBtnText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  inspectDescription: {
    ...typography.presets.bodySmall,
    fontSize: 13,
    lineHeight: 18,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  connectedLabel: {
    ...typography.presets.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  relPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  relVerb: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  relTarget: {
    ...typography.presets.caption,
    fontSize: 11,
    maxWidth: 90,
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
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
  },
  primaryActionBtnText: {
    ...typography.presets.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
