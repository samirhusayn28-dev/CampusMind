import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../store/useSettingsStore';

export type HapticType =
  | 'lightImpact'
  | 'mediumImpact'
  | 'heavyImpact'
  | 'successNotification'
  | 'errorNotification'
  | 'warningNotification'
  | 'selection';

/**
 * Safe, centralized haptic feedback trigger that respects user settings
 * and device capabilities without crashing.
 */
export async function triggerHaptic(type: HapticType = 'lightImpact'): Promise<void> {
  try {
    const isEnabled = useSettingsStore.getState().hapticsEnabled;
    if (!isEnabled) return;

    switch (type) {
      case 'lightImpact':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'mediumImpact':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavyImpact':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'successNotification':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'errorNotification':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warningNotification':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
      default:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Graceful no-op on devices/environments without vibration motor support
  }
}

export const lightImpact = () => triggerHaptic('lightImpact');
export const mediumImpact = () => triggerHaptic('mediumImpact');
export const heavyImpact = () => triggerHaptic('heavyImpact');
export const successNotification = () => triggerHaptic('successNotification');
export const errorNotification = () => triggerHaptic('errorNotification');
export const warningNotification = () => triggerHaptic('warningNotification');
export const selectionHaptic = () => triggerHaptic('selection');
