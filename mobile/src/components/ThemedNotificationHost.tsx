import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
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
import { typography, spacing, borderRadius } from '../theme';

// Single Toast Component with Slide & Fade (High-Contrast Solid WCAG AA/AAA)
const SingleToast: React.FC<{
  toast: ToastItem;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
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
          bg: isDark ? '#1C2E20' : '#E8F5E9',
          border: isDark ? '#3D7A4C' : '#2E7D32',
          icon: 'checkmark-circle' as const,
          iconColor: isDark ? '#81C784' : '#1B5E20',
          titleColor: isDark ? '#FFFFFF' : '#0F3814',
          textColor: isDark ? '#E8F5E9' : '#15471B',
          closeColor: isDark ? '#81C784' : '#2E7D32',
        };
      case 'error':
        return {
          bg: isDark ? '#3E1C1A' : '#FFEBEE',
          border: isDark ? '#C62828' : '#D32F2F',
          icon: 'alert-circle' as const,
          iconColor: isDark ? '#EF9A9A' : '#B71C1C',
          titleColor: isDark ? '#FFFFFF' : '#7F0000',
          textColor: isDark ? '#FFEBEE' : '#931212',
          closeColor: isDark ? '#EF9A9A' : '#B71C1C',
        };
      case 'warning':
        return {
          bg: isDark ? '#3E2F13' : '#FFF8E1',
          border: isDark ? '#F57F17' : '#F57F17',
          icon: 'warning' as const,
          iconColor: isDark ? '#FFE082' : '#C43E00',
          titleColor: isDark ? '#FFFFFF' : '#5C2B00',
          textColor: isDark ? '#FFF8E1' : '#6D3400',
          closeColor: isDark ? '#FFE082' : '#C43E00',
        };
      case 'info':
      default:
        return {
          bg: isDark ? '#16283B' : '#E3F2FD',
          border: isDark ? '#1976D2' : '#1976D2',
          icon: 'information-circle' as const,
          iconColor: isDark ? '#90CAF9' : '#0D47A1',
          titleColor: isDark ? '#FFFFFF' : '#052A5E',
          textColor: isDark ? '#E3F2FD' : '#0A3979',
          closeColor: isDark ? '#90CAF9' : '#0D47A1',
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
          size={24}
          color={themeStyle.iconColor}
          style={styles.toastIcon}
        />
        <View style={styles.toastTextContainer}>
          {toast.title ? (
            <Text
              style={[
                styles.toastTitle,
                { color: themeStyle.titleColor },
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
          size={18}
          color={themeStyle.closeColor}
          style={styles.toastCloseIcon}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Themed Confirmation Dialog Component (High-Contrast Solid WCAG AA/AAA)
const ThemedDialogModal: React.FC<{
  dialog: DialogItem;
  onClose: () => void;
}> = ({ dialog, onClose }) => {
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

  const dialogBg = isDark ? '#1E201E' : '#FFFFFF';
  const dialogBorder = isDark ? '#333733' : '#E0E0E0';
  const titleColor = isDark ? '#F0F2ED' : '#1A1C19';
  const messageColor = isDark ? '#C4C7C0' : '#3E433E';

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
              backgroundColor: dialogBg,
              borderColor: dialogBorder,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.dialogHeader}>
            <Text style={[styles.dialogTitle, { color: titleColor }]}>
              {dialog.title}
            </Text>
            {dialog.message ? (
              <Text style={[styles.dialogMessage, { color: messageColor }]}>
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
                      ? { backgroundColor: '#D32F2F', borderWidth: 0 }
                      : isCancel
                      ? { backgroundColor: isDark ? '#2C2F2B' : '#F1F3F0' }
                      : { backgroundColor: isDark ? '#406A4E' : '#2D4F3A' },
                  ]}
                  onPress={() => handleButtonPress(btn.onPress)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dialogButtonText,
                      isDestructive
                        ? { color: '#FFFFFF', fontWeight: '700' }
                        : isCancel
                        ? { color: isDark ? '#E2E4DE' : '#2E312D', fontWeight: '600' }
                        : { color: '#FFFFFF', fontWeight: '700' },
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
    borderWidth: 1.5,
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  toastInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  toastIcon: {
    marginRight: spacing.sm + 2,
  },
  toastTextContainer: {
    flex: 1,
    marginRight: spacing.xs,
  },
  toastTitle: {
    ...typography.presets.bodySmall,
    fontWeight: '700',
    marginBottom: 2,
  },
  toastMessage: {
    ...typography.presets.caption,
    fontWeight: '500',
    lineHeight: 18,
  },
  toastCloseIcon: {
    padding: spacing.xxs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
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
    lineHeight: 22,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  dialogButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  dialogButtonText: {
    ...typography.presets.bodyMedium,
  },
});
