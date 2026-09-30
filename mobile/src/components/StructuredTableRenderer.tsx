import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { StructuredTable } from '../types/content';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface StructuredTableRendererProps {
  tables?: StructuredTable[];
}

export const StructuredTableRenderer: React.FC<StructuredTableRendererProps> = ({ tables }) => {
  const { colors, isDark } = useThemeStore();

  if (!tables || tables.length === 0) return null;

  return (
    <View style={styles.container}>
      {tables.map((table, tIdx) => {
        const columns = table.columns || [];
        const rows = table.rows || [];

        if (columns.length === 0 || rows.length === 0) return null;

        return (
          <View
            key={`table_${tIdx}`}
            style={[
              styles.tableCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
              },
            ]}
          >
            {/* Table Header / Title */}
            <View style={[styles.titleRow, { borderBottomColor: colors.borderSubtle }]}>
              <View style={[styles.tableIconCircle, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="grid-outline" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.tableTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {table.title || `Data Table ${tIdx + 1}`}
              </Text>
            </View>

            {/* Scrollable Table Viewport */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.tableScrollContent}
              bounces={false}
            >
              <View style={styles.tableGrid}>
                {/* Column Headers */}
                <View
                  style={[
                    styles.headerRow,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderBottomColor: colors.borderSubtle,
                    },
                  ]}
                >
                  {columns.map((col, cIdx) => (
                    <View key={`col_${cIdx}`} style={styles.cellHeader}>
                      <Text style={[styles.headerCellText, { color: colors.textPrimary }]} numberOfLines={2}>
                        {col}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Table Rows */}
                {rows.map((row, rIdx) => {
                  const isEven = rIdx % 2 === 0;
                  const rowBg = isEven
                    ? 'transparent'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.03)'
                    : 'rgba(0, 0, 0, 0.02)';

                  return (
                    <View
                      key={`row_${rIdx}`}
                      style={[
                        styles.dataRow,
                        {
                          backgroundColor: rowBg,
                          borderBottomColor: colors.borderSubtle,
                        },
                      ]}
                    >
                      {columns.map((_, cIdx) => {
                        const cellVal = row[cIdx] ?? '';
                        return (
                          <View key={`cell_${rIdx}_${cIdx}`} style={styles.cellData}>
                            <Text
                              style={[styles.dataCellText, { color: colors.textSecondary }]}
                              numberOfLines={3}
                            >
                              {cellVal}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Table Footer Meta */}
            <View style={[styles.footerRow, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {rows.length} {rows.length === 1 ? 'row' : 'rows'} • {columns.length} {columns.length === 1 ? 'column' : 'columns'}
              </Text>
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
  tableCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  tableIconCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableTitle: {
    ...typography.presets.titleSmall,
    fontWeight: '700',
    flex: 1,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableGrid: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  cellHeader: {
    width: 140,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  headerCellText: {
    ...typography.presets.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellData: {
    width: 140,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  dataCellText: {
    ...typography.presets.bodySmall,
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    ...typography.presets.caption,
    fontSize: 11,
  },
});
