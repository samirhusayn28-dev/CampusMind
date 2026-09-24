import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import {
  useNotificationStore,
  ToastItem,
  ToastType,
  DialogItem,
} from '../store/useNotificationStore';
import { typography, spacing, borderRadius, shadows } from '../theme';

// Single Toast Component with Slide & Fade
const SingleToast: React.FC<{
  toast: ToastItem;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  const colors = useThemeStore((state) => state.colors);
  const isDark = useThemeStore((state) => state.isDark);
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 150,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -40,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const getStyleForType = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: isDark ? 'rgba(40, 65, 45, 0.95)' : colors.primaryContainer,
          border: colors.primary,
          icon: 'checkmark-circle' as const,
          iconColor: colors.primary,
          textColor: isDark ? colors.textPrimary : colors.onPrimaryContainer,
        };
      case 'error':
        return {
          bg: isDark ? 'rgba(75, 35, 30, 0.95)' : colors.peachContainer,
          border: colors.peach,
          icon: 'alert-circle' as const,
          iconColor: colors.peach,
          textColor: isDark ? colors.textPrimary : colors.onPeach,
        };
      case 'warning':
        return {
          bg: isDark ? 'rgba(70, 55, 25, 0.95)' : colors.amberContainer,
          border: colors.amber,
          icon: 'warning' as const,
          iconColor: colors.amber,
          textColor: isDark ? colors.textPrimary : colors.onAmber,
        };
      case 'info':
      default:
        return {
          bg: isDark ? 'rgba(30, 48, 70, 0.95)' : colors.skyContainer,
          border: colors.sky,
          icon: 'information-circle' as const,
          iconColor: colors.sky,
          textColor: isDark ? colors.textPrimary : colors.onSky,
        };
    }
  };

  const themeStyle = getStyleForType(toast.type);

  return (
    <Animated.View
      style={[
        styles.toastCard,
        {
          backgroundColor: themeStyle.bg,
          borderColor: themeStyle.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastInnerRow}
        onPress={handleDismiss}
        activeOpacity={0.85}
      >
        <Ionicons
          name={themeStyle.icon}
          size={22}
          color={themeStyle.iconColor}
          style={styles.toastIcon}
        />
        <View style={styles.toastTextContainer}>
          {toast.title ? (
            <Text
              style={[
                styles.toastTitle,
                { color: themeStyle.textColor },
              ]}
              numberOfLines={1}
            >
              {toast.title}
            </Text>
          ) : null}
          <Text
            style={[
              styles.toastMessage,
              { color: themeStyle.textColor },
            ]}
            numberOfLines={2}
          >
            {toast.message}
          </Text>
        </View>
        <Ionicons
          name="close"
          size={16}
          color={colors.textSecondary}
          style={styles.toastCloseIcon}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Themed Confirmation Dialog Component
const ThemedDialogModal: React.FC<{
  dialog: DialogItem;
  onClose: () => void;
}> = ({ dialog, onClose }) => {
  const colors = useThemeStore((state) => state.colors);
  const isDark = useThemeStore((state) => state.isDark);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handleButtonPress = (onPress?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (onPress) {
        onPress();
      }
    });
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        <Animated.View
          style={[
            styles.dialogCard,
            {
              backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
              borderColor: colors.borderSubtle,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.dialogHeader}>
            <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
              {dialog.title}
            </Text>
            {dialog.message ? (
              <Text style={[styles.dialogMessage, { color: colors.textSecondary }]}>
                {dialog.message}
              </Text>
            ) : null}
          </View>

          <View style={styles.dialogActions}>
            {dialog.buttons.map((btn, index) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';

              return (
                <TouchableOpacity
                  key={`btn_${index}`}
                  style={[
                    styles.dialogButton,
                    isDestructive
                      ? { backgroundColor: isDark ? 'rgba(180, 50, 40, 0.25)' : colors.peachContainer, borderColor: colors.peach, borderWidth: 1 }
                      : isCancel
                      ? { backgroundColor: colors.surfaceSubtle }
                      : { backgroundColor: colors.primary },
                  ]}
                  onPress={() => handleButtonPress(btn.onPress)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dialogButtonText,
                      isDestructive
                        ? { color: colors.peach, fontWeight: '700' }
                        : isCancel
                        ? { color: colors.textSecondary }
                        : { color: colors.onPrimary, fontWeight: '700' },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export const ThemedNotificationHost: React.FC = () => {
  const insets = useSafeAreaInsets();
  const toasts = useNotificationStore((state) => state.toasts);
  const currentDialog = useNotificationStore((state) => state.currentDialog);
  const hideToast = useNotificationStore((state) => state.hideToast);
  const hideDialog = useNotificationStore((state) => state.hideDialog);

  return (
    <>
      {/* Toast Overlay Container */}
      {toasts.length > 0 && (
        <View
          pointerEvents="box-none"
          style={[
            styles.toastContainer,
            { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 12) + spacing.xs },
          ]}
        >
          {toasts.map((toast) => (
            <SingleToast
              key={toast.id}
              toast={toast}
              onDismiss={() => hideToast(toast.id)}
            />
          ))}
        </View>
      )}

      {/* Dialog Modal Container */}
      {currentDialog && (
        <ThemedDialogModal
          dialog={currentDialog}
          onClose={hideDialog}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  toastInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  toastIcon: {
    marginRight: spacing.sm,
  },
  toastTextContainer: {
    flex: 1,
    marginRight: spacing.xs,
  },
  toastTitle: {
    ...typography.presets.bodySmall,
    fontWeight: '700',
    marginBottom: 1,
  },
  toastMessage: {
    ...typography.presets.caption,
    lineHeight: 16,
  },
  toastCloseIcon: {
    padding: spacing.xxs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  dialogHeader: {
    marginBottom: spacing.lg,
  },
  dialogTitle: {
    ...typography.presets.titleLarge,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  dialogMessage: {
    ...typography.presets.bodyMedium,
    lineHeight: 21,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  dialogButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  dialogButtonText: {
    ...typography.presets.bodyMedium,
  },
});
