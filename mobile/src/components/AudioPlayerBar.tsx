import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { spacing, borderRadius, shadows } from '../theme/spacing';
import { typography } from '../theme/typography';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  rate: number;
  languageLabel: string;
  onPlayPause: () => void;
  onStop: () => void;
  onToggleRate: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  isPaused,
  rate,
  languageLabel,
  onPlayPause,
  onStop,
  onToggleRate,
}) => {
  const { colors } = useThemeStore();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      {/* Icon & Title Info */}
      <View style={styles.leftInfo}>
        <View style={[styles.speakerIconWrapper, { backgroundColor: colors.primaryContainer }]}>
          <Ionicons
            name={isPlaying ? 'volume-high' : 'volume-medium-outline'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.textBox}>
          <Text style={[styles.statusText, { color: colors.textPrimary }]}>
            {isPlaying ? 'Listening to Summary' : isPaused ? 'Paused' : 'Ready to Listen'}
          </Text>
          <Text style={[styles.langText, { color: colors.textTertiary }]}>
            Voice: {languageLabel}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        {/* Speed Toggle Pill */}
        <TouchableOpacity
          style={[styles.rateBtn, { backgroundColor: colors.surfaceSubtle }]}
          onPress={onToggleRate}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.rateText, { color: colors.textPrimary }]}>{rate.toFixed(2).replace(/\.00$/, '')}x</Text>
        </TouchableOpacity>

        {/* Play / Pause Pill Button */}
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: colors.primary }]}
          onPress={onPlayPause}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={colors.onPrimary}
          />
        </TouchableOpacity>

        {/* Stop Button */}
        {(isPlaying || isPaused) && (
          <TouchableOpacity
            style={[styles.stopBtn, { backgroundColor: colors.surfaceSubtle }]}
            onPress={onStop}
            activeOpacity={0.7}
          >
            <Ionicons name="stop" size={16} color={colors.peach} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    ...shadows.card,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  speakerIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    flex: 1,
  },
  statusText: {
    ...typography.presets.labelLarge,
    fontSize: 13,
  },
  langText: {
    ...typography.presets.tiny,
    marginTop: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  rateBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  rateText: {
    ...typography.presets.labelMedium,
    fontSize: 11,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
