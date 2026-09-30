import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { StructuredChart } from '../types/content';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface StructuredChartRendererProps {
  charts?: StructuredChart[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = Math.min(SCREEN_WIDTH - 64, 400);

export const StructuredChartRenderer: React.FC<StructuredChartRendererProps> = ({ charts }) => {
  const { colors, isDark } = useThemeStore();

  if (!charts || charts.length === 0) return null;

  const palette = [
    colors.primary,
    colors.lavender,
    colors.peach,
    colors.sky,
    colors.amber,
  ];

  return (
    <View style={styles.container}>
      {charts.map((chart, cIdx) => {
        const type = chart.type || 'bar';
        const labels = chart.labels || [];
        const series = chart.series || [];

        if (labels.length === 0 || series.length === 0) return null;

        const firstSeries = series[0] || { name: 'Value', data: [] };
        const rawData = firstSeries.data || [];
        const validData = rawData.map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0));
        const maxVal = Math.max(...validData, 1);
        const minVal = Math.min(...validData, 0);

        return (
          <View
            key={`chart_${cIdx}`}
            style={[
              styles.chartCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            {/* Header */}
            <View style={[styles.titleRow, { borderBottomColor: colors.borderSubtle }]}>
              <View
                style={[
                  styles.chartIconCircle,
                  {
                    backgroundColor:
                      type === 'bar'
                        ? colors.primaryContainer
                        : type === 'line'
                        ? colors.lavenderContainer
                        : colors.peachContainer,
                  },
                ]}
              >
                <Ionicons
                  name={
                    type === 'bar'
                      ? 'bar-chart-outline'
                      : type === 'line'
                      ? 'trending-up-outline'
                      : 'pie-chart-outline'
                  }
                  size={16}
                  color={
                    type === 'bar'
                      ? colors.primary
                      : type === 'line'
                      ? colors.lavender
                      : colors.peach
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chartTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {chart.title || `Data Chart ${cIdx + 1}`}
                </Text>
                {firstSeries.name && firstSeries.name !== 'Value' && (
                  <Text style={[styles.chartSub, { color: colors.textTertiary }]} numberOfLines={1}>
                    {firstSeries.name}
                  </Text>
                )}
              </View>
            </View>

            {/* Chart Body */}
            <View style={styles.chartViewport}>
              {type === 'bar' && (
                <View style={styles.barList}>
                  {labels.map((label, lIdx) => {
                    const val = validData[lIdx] ?? 0;
                    const pct = Math.max(4, Math.round((val / maxVal) * 100));
                    const barColor = palette[lIdx % palette.length];

                    return (
                      <View key={`bar_${lIdx}`} style={styles.barRow}>
                        <Text style={[styles.barLabelText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {label}
                        </Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: barColor,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barValueText, { color: colors.textPrimary }]}>
                          {val}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {type === 'line' && (
                <View style={styles.lineChartBox}>
                  {(() => {
                    const height = 160;
                    const padding = 24;
                    const plotWidth = CHART_WIDTH - padding * 2;
                    const plotHeight = height - padding * 2;

                    const range = maxVal - minVal || 1;
                    const points = validData.map((val, idx) => {
                      const x = padding + (idx / Math.max(1, validData.length - 1)) * plotWidth;
                      const y = height - padding - ((val - minVal) / range) * plotHeight;
                      return { x, y, val };
                    });

                    const pathD = points
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                      .join(' ');

                    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`;

                    return (
                      <Svg width={CHART_WIDTH} height={height}>
                        <Defs>
                          <LinearGradient id={`lineGrad_${cIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
                            <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.0" />
                          </LinearGradient>
                        </Defs>

                        {/* Baseline */}
                        <Line
                          x1={padding}
                          y1={height - padding}
                          x2={CHART_WIDTH - padding}
                          y2={height - padding}
                          stroke={colors.borderSubtle}
                          strokeWidth={1}
                        />

                        {/* Area Fill */}
                        <Path d={areaD} fill={`url(#lineGrad_${cIdx})`} />

                        {/* Line Stroke */}
                        <Path d={pathD} fill="none" stroke={colors.primary} strokeWidth={2.5} />

                        {/* Data Points */}
                        {points.map((p, pIdx) => (
                          <G key={`pt_${pIdx}`}>
                            <Circle cx={p.x} cy={p.y} r={4.5} fill={colors.surface} stroke={colors.primary} strokeWidth={2} />
                            <SvgText
                              x={p.x}
                              y={p.y - 8}
                              fontSize={10}
                              fontWeight="600"
                              fill={colors.textSecondary}
                              textAnchor="middle"
                            >
                              {p.val}
                            </SvgText>
                          </G>
                        ))}
                      </Svg>
                    );
                  })()}

                  {/* Line Chart X-Axis Labels */}
                  <View style={[styles.axisLabelRow, { paddingHorizontal: 24 }]}>
                    {labels.map((lbl, idx) => (
                      <Text
                        key={`x_${idx}`}
                        style={[styles.axisLabelText, { color: colors.textTertiary }]}
                        numberOfLines={1}
                      >
                        {lbl}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {type === 'pie' && (
                <View style={styles.pieContainer}>
                  {/* Proportional Segment Bar */}
                  <View style={styles.donutSegmentBar}>
                    {(() => {
                      const total = validData.reduce((a, b) => a + b, 0) || 1;
                      return validData.map((val, idx) => {
                        const pct = Math.max(1, (val / total) * 100);
                        const sliceColor = palette[idx % palette.length];
                        return (
                          <View
                            key={`slice_${idx}`}
                            style={{
                              flex: pct,
                              height: 14,
                              backgroundColor: sliceColor,
                              borderRightWidth: idx < validData.length - 1 ? 2 : 0,
                              borderRightColor: colors.surface,
                            }}
                          />
                        );
                      });
                    })()}
                  </View>

                  {/* Legend list with counts and percentages */}
                  <View style={styles.legendGrid}>
                    {(() => {
                      const total = validData.reduce((a, b) => a + b, 0) || 1;
                      return labels.map((lbl, idx) => {
                        const val = validData[idx] ?? 0;
                        const pct = Math.round((val / total) * 100);
                        const sliceColor = palette[idx % palette.length];

                        return (
                          <View key={`leg_${idx}`} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: sliceColor }]} />
                            <Text style={[styles.legendLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                              {lbl}
                            </Text>
                            <Text style={[styles.legendVal, { color: colors.textSecondary }]}>
                              {val} ({pct}%)
                            </Text>
                          </View>
                        );
                      });
                    })()}
                  </View>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  chartCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  chartIconCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
  },
  chartSub: {
    ...typography.presets.caption,
    fontSize: 11,
  },
  chartViewport: {
    padding: spacing.md,
  },
  // Bar Chart Styles
  barList: {
    gap: spacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabelText: {
    width: 90,
    ...typography.presets.bodySmall,
    fontSize: 12,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  barValueText: {
    width: 36,
    textAlign: 'right',
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  // Line Chart Styles
  lineChartBox: {
    alignItems: 'center',
  },
  axisLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  axisLabelText: {
    ...typography.presets.caption,
    fontSize: 10,
  },
  // Pie Chart Styles
  pieContainer: {
    gap: spacing.md,
  },
  donutSegmentBar: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    height: 14,
  },
  legendGrid: {
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  legendLabel: {
    flex: 1,
    ...typography.presets.bodySmall,
    fontSize: 12,
  },
  legendVal: {
    ...typography.presets.caption,
    fontSize: 11,
    fontWeight: '600',
  },
});
