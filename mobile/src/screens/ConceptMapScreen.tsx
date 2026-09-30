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
import Svg, { Line, Path, Rect, Text as SvgText, G, Circle, Polygon } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useContentStore } from '../store/useContentStore';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';
import { ConceptNode, ConceptEdge, ConceptMapData, StudyMaterial } from '../types/content';
import { ThemedLoader } from '../components/ThemedLoader';
import { useStudySession } from '../services/studyTimer';

interface ConceptMapScreenProps {
  onBack?: () => void;
  materialId?: string;
  onNavigateToChat?: () => void;
  navigation?: any;
  route?: any;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TierLayout {
  tiers: ConceptNode[][];
  positions: Record<string, NodePosition>;
  canvasWidth: number;
  canvasHeight: number;
}

export const ConceptMapScreen: React.FC<ConceptMapScreenProps> = (props) => {
  const navigation = props.navigation;
  const route = props.route;
  const onBack = props.onBack || (() => navigation?.goBack());
  const materialId = props.materialId ?? route?.params?.materialId;
  const onNavigateToChat =
    props.onNavigateToChat ||
    (navigation ? () => navigation.navigate('MainTabs', { screen: 'StudyChat' }) : undefined);
  useStudySession('concept_map');
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
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
  const [zoomScale, setZoomScale] = useState(1.0);

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

  // Compute dynamic multi-tier layout avoiding node overlaps
  const layoutData = useMemo<TierLayout>(() => {
    if (!conceptMap || conceptMap.nodes.length === 0) {
      return { tiers: [], positions: {}, canvasWidth: 900, canvasHeight: 650 };
    }

    const nodes = conceptMap.nodes;
    const rootNode = nodes.find((n) => n.category === 'root') || nodes[0];
    const remaining = nodes.filter((n) => n.id !== rootNode.id);

    // Group remaining nodes by hierarchy
    const coreGroup: ConceptNode[] = [];
    const mechanismGroup: ConceptNode[] = [];
    const applicationGroup: ConceptNode[] = [];
    const otherGroup: ConceptNode[] = [];

    remaining.forEach((node) => {
      if (node.category === 'core') coreGroup.push(node);
      else if (node.category === 'mechanism') mechanismGroup.push(node);
      else if (node.category === 'application' || node.category === 'example') applicationGroup.push(node);
      else otherGroup.push(node);
    });

    // Build hierarchical tiers (limit each tier row to max 3-4 nodes to prevent crowding)
    const tiers: ConceptNode[][] = [[rootNode]];

    const addGroupToTiers = (list: ConceptNode[]) => {
      if (list.length === 0) return;
      const chunkSize = list.length <= 4 ? list.length : 3;
      for (let i = 0; i < list.length; i += chunkSize) {
        tiers.push(list.slice(i, i + chunkSize));
      }
    };

    addGroupToTiers(coreGroup);
    addGroupToTiers(mechanismGroup);
    addGroupToTiers(applicationGroup);
    addGroupToTiers(otherGroup);

    if (tiers.length === 1 && remaining.length > 0) {
      for (let i = 0; i < remaining.length; i += 3) {
        tiers.push(remaining.slice(i, i + 3));
      }
    }

    // Dynamic dimensions ensuring >= 210px node separation (node width 156px)
    const maxNodesInAnyTier = Math.max(...tiers.map((t) => t.length), 1);
    const minHorizontalSlot = 220;
    const canvasWidth = Math.max(900, (maxNodesInAnyTier + 1) * minHorizontalSlot);
    const verticalTierSpacing = 150;
    const canvasHeight = Math.max(700, 110 + tiers.length * verticalTierSpacing);

    const positions: Record<string, NodePosition> = {};
    const DEFAULT_NODE_WIDTH = 156;
    const DEFAULT_NODE_HEIGHT = 50;

    tiers.forEach((tierNodes, tierIdx) => {
      const y = 90 + tierIdx * verticalTierSpacing;
      const step = canvasWidth / (tierNodes.length + 1);

      tierNodes.forEach((node, nodeIdx) => {
        const x = step * (nodeIdx + 1);
        const isRoot = node.id === rootNode.id;
        positions[node.id] = {
          x,
          y,
          width: isRoot ? 176 : DEFAULT_NODE_WIDTH,
          height: isRoot ? 54 : DEFAULT_NODE_HEIGHT,
        };
      });
    });

    return { tiers, positions, canvasWidth, canvasHeight };
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

  const handleZoomIn = () => {
    setZoomScale((z) => Math.min(1.8, Math.round((z + 0.2) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoomScale((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10));
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
  };

  // 1. Loading State
  if (isGeneratingConceptMap || isLocalLoading) {
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, spacing.xl), paddingBottom: insets.bottom, justifyContent: 'center' }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ThemedLoader
          title="Mapping Concepts"
          stage={`Analyzing structural dependencies in ${currentMaterial?.title || 'your lecture'}...`}
          stages={[
            `Analyzing key topics in ${currentMaterial?.title || 'your lecture'}...`,
            'Detecting parent-child topic hierarchies...',
            'Computing semantic graph layout & connection edges...',
            'Rendering interactive concept nodes...',
          ]}
          subtext="Building an interactive knowledge graph for visual learning."
          icon="git-network-outline"
          variant="sky"
          size="large"
        />
      </View>
    );
  }

  // 2. Empty State
  if (!conceptMap || conceptMap.nodes.length === 0) {
    return (
      <View style={[styles.safeArea, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, spacing.md) }]}>
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
      </View>
    );
  }

  const lineStrokeColor = isDark ? '#3F3F46' : '#D1D5DB';

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.topBar, { borderBottomColor: colors.borderSubtle, paddingTop: Math.max(insets.top, spacing.md) }]}>
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
            <View
              style={{
                width: layoutData.canvasWidth * zoomScale,
                height: layoutData.canvasHeight * zoomScale,
              }}
            >
              <Svg
                width={layoutData.canvasWidth * zoomScale}
                height={layoutData.canvasHeight * zoomScale}
                viewBox={`0 0 ${layoutData.canvasWidth} ${layoutData.canvasHeight}`}
                style={StyleSheet.absoluteFill}
              >
                {/* 1. Render connecting relationship edges with cubic bezier curves & arrowheads */}
                {conceptMap.edges.map((edge, eIdx) => {
                  const src = layoutData.positions[edge.source];
                  const tgt = layoutData.positions[edge.target];
                  if (!src || !tgt) return null;

                  const isConnectedToSelected =
                    selectedNodeId === edge.source || selectedNodeId === edge.target;

                  // Vertical orientation
                  const isTgtBelow = tgt.y >= src.y;
                  const startX = src.x;
                  const startY = isTgtBelow ? src.y + src.height / 2 : src.y - src.height / 2;
                  const endX = tgt.x;
                  const endY = isTgtBelow ? tgt.y - tgt.height / 2 - 4 : tgt.y + tgt.height / 2 + 4;

                  const dy = endY - startY;
                  const controlOffset = Math.max(35, Math.abs(dy) * 0.45);
                  const cp1X = startX;
                  const cp1Y = isTgtBelow ? startY + controlOffset : startY - controlOffset;
                  const cp2X = endX;
                  const cp2Y = isTgtBelow ? endY - controlOffset : endY + controlOffset;

                  const curvePath = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

                  // Exact cubic bezier midpoint at t=0.5
                  const midX = 0.125 * startX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * endX;
                  const midY = 0.125 * startY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * endY;

                  // Arrowhead calculation
                  const arrowDx = endX - cp2X;
                  const arrowDy = endY - cp2Y;
                  const angle = Math.atan2(arrowDy, arrowDx);
                  const arrowSize = 7;
                  const arrowP1X = endX;
                  const arrowP1Y = endY;
                  const arrowP2X = endX - arrowSize * Math.cos(angle - Math.PI / 6);
                  const arrowP2Y = endY - arrowSize * Math.sin(angle - Math.PI / 6);
                  const arrowP3X = endX - arrowSize * Math.cos(angle + Math.PI / 6);
                  const arrowP3Y = endY - arrowSize * Math.sin(angle + Math.PI / 6);
                  const arrowPoints = `${arrowP1X},${arrowP1Y} ${arrowP2X},${arrowP2Y} ${arrowP3X},${arrowP3Y}`;

                  const strokeColor = isConnectedToSelected ? colors.primary : lineStrokeColor;

                  return (
                    <G key={`edge_${eIdx}`}>
                      {/* Curved line */}
                      <Path
                        d={curvePath}
                        stroke={strokeColor}
                        strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                        strokeDasharray={isConnectedToSelected ? undefined : '5,4'}
                        fill="none"
                      />

                      {/* Directional arrowhead */}
                      <Polygon
                        points={arrowPoints}
                        fill={strokeColor}
                      />

                      {/* Midpoint relationship pill */}
                      {edge.label ? (
                        <G>
                          <Rect
                            x={midX - 42}
                            y={midY - 10}
                            width={84}
                            height={20}
                            rx={10}
                            fill={isDark ? '#262629' : '#FFFFFF'}
                            stroke={isConnectedToSelected ? colors.primary : colors.borderSubtle}
                            strokeWidth={isConnectedToSelected ? 1.5 : 1}
                          />
                          <SvgText
                            x={midX}
                            y={midY + 3.5}
                            fontSize={9}
                            fontWeight="600"
                            fill={isConnectedToSelected ? colors.primary : colors.textTertiary}
                            textAnchor="middle"
                          >
                            {edge.label.length > 15 ? `${edge.label.slice(0, 13)}…` : edge.label}
                          </SvgText>
                        </G>
                      ) : null}
                    </G>
                  );
                })}

                {/* 2. Render concept nodes */}
                {conceptMap.nodes.map((node) => {
                  const pos = layoutData.positions[node.id];
                  if (!pos) return null;

                  const isSelected = selectedNodeId === node.id;
                  const catStyle = getCategoryStyles(node.category);

                  const nodeX = pos.x - pos.width / 2;
                  const nodeY = pos.y - pos.height / 2;

                  const displayLabel =
                    node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label;

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
                          rx={18}
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
                        rx={14}
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
                        x={pos.x + 8}
                        y={pos.y + 4}
                        fontSize={node.category === 'root' ? 12 : 11}
                        fontWeight={isSelected ? '700' : '600'}
                        fill={isSelected ? catStyle.text : colors.textPrimary}
                        textAnchor="middle"
                      >
                        {displayLabel}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
            </View>
          </ScrollView>
        </ScrollView>

        {/* Floating Zoom Controls (+, -, Reset) */}
        <View
          style={[
            styles.zoomControls,
            {
              backgroundColor: isDark ? 'rgba(38,38,41,0.92)' : 'rgba(255,255,255,0.92)',
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomIn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.zoomResetButton}
            onPress={handleResetZoom}
            activeOpacity={0.7}
          >
            <Text style={[styles.zoomLevelText, { color: colors.textSecondary }]}>
              {Math.round(zoomScale * 100)}%
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomOut}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="remove" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Interactive Concept Inspection Bottom Sheet */}
      {selectedNode && (
        <View
          style={[
            styles.inspectCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, spacing.md),
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
    </View>
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
    position: 'relative',
  },
  canvasHorizontalScroll: {
    flexGrow: 1,
  },
  canvasVerticalScroll: {
    flexGrow: 1,
  },
  zoomControls: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomResetButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLevelText: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '700',
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
