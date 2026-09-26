import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { checkForAppUpdate, AppUpdateInfo } from '../services/updateChecker';
import { triggerHaptic } from '../services/haptics';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

let sessionDismissedVersion: string | null = null;

export const InAppUpdateModal: React.FC = () => {
  const { colors, isDark } = useThemeStore();
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Non-blocking background check 1.5s after launch
    const timer = setTimeout(async () => {
      try {
        const info = await checkForAppUpdate();
        if (
          info.updateAvailable &&
          info.latestVersion !== sessionDismissedVersion
        ) {
          setUpdateInfo(info);
          setIsVisible(true);
        }
      } catch {
        // Silently ignore non-fatal update check failures
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    triggerHaptic('lightImpact');
    if (updateInfo) {
      sessionDismissedVersion = updateInfo.latestVersion;
    }
    setIsVisible(false);
  };

  const handleDownload = () => {
    triggerHaptic('selection');
    const targetUrl =
      updateInfo?.apkDownloadUrl ||
      updateInfo?.releasePageUrl ||
      'https://github.com/samirhusayn28-dev/CampusMind/releases';

    Linking.openURL(targetUrl).catch(() => {});
    setIsVisible(false);
  };

  if (!isVisible || !updateInfo) return null;

  // Extract first 2-3 bullet lines or brief highlights from release notes
  const notesSnippet = (updateInfo.releaseNotes || '')
    .split('\n')
    .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'))
    .slice(0, 4)
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleDismiss}
        />

        <View
          style={[
            styles.dialogCard,
            {
              backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.dialogHeader}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Ionicons name="rocket-outline" size={24} color={colors.primary} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
                New Update Available!
              </Text>
              <Text style={[styles.versionSubtitle, { color: colors.textSecondary }]}>
                {`CampusMind v${updateInfo.latestVersion} is ready to download`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleDismiss}
              style={[styles.closeIconBtn, { backgroundColor: colors.surfaceSubtle }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Current vs New comparison */}
          <View
            style={[
              styles.versionCompareRow,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle },
            ]}
          >
            <View style={styles.compareItem}>
              <Text style={[styles.compareLabel, { color: colors.textTertiary }]}>
                Installed
              </Text>
              <Text style={[styles.compareVal, { color: colors.textSecondary }]}>
                {`v${updateInfo.currentVersion}`}
              </Text>
            </View>

            <Ionicons name="arrow-forward" size={16} color={colors.primary} />

            <View style={styles.compareItem}>
              <Text style={[styles.compareLabel, { color: colors.textTertiary }]}>
                Latest
              </Text>
              <Text style={[styles.compareVal, { color: colors.primary, fontWeight: '700' }]}>
                {`v${updateInfo.latestVersion}`}
              </Text>
            </View>
          </View>

          {/* Release Highlights */}
          {notesSnippet.length > 0 && (
            <View style={styles.highlightsContainer}>
              <Text style={[styles.highlightsHeading, { color: colors.textSecondary }]}>
                What's New:
              </Text>
              <ScrollView style={{ maxHeight: 110 }} showsVerticalScrollIndicator={false}>
                {notesSnippet.map((item, idx) => (
                  <View key={`note_${idx}`} style={styles.highlightItem}>
                    <Text style={[styles.highlightBullet, { color: colors.primary }]}>
                      •
                    </Text>
                    <Text
                      style={[styles.highlightText, { color: colors.textPrimary }]}
                      numberOfLines={2}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.laterBtn, { backgroundColor: colors.surfaceSubtle }]}
              onPress={handleDismiss}
            >
              <Text style={[styles.laterBtnText, { color: colors.textSecondary }]}>
                Later
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-download-outline" size={18} color={colors.onPrimary} />
              <Text style={[styles.downloadBtnText, { color: colors.onPrimary }]}>
                Download Update
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.floating,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    ...typography.presets.titleMedium,
    fontWeight: '700',
    fontSize: 16.5,
  },
  versionSubtitle: {
    ...typography.presets.bodySmall,
    fontSize: 12.5,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  compareItem: {
    alignItems: 'center',
  },
  compareLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  compareVal: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  highlightsContainer: {
    marginBottom: spacing.md,
  },
  highlightsHeading: {
    ...typography.presets.labelMedium,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: 2,
  },
  highlightBullet: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  highlightText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  laterBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnText: {
    ...typography.presets.labelMedium,
    fontWeight: '600',
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    ...shadows.card,
  },
  downloadBtnText: {
    ...typography.presets.labelLarge,
    fontWeight: '700',
  },
});
