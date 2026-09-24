import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogItem {
  id: string;
  title: string;
  message: string;
  buttons: DialogButton[];
}

interface NotificationState {
  toasts: ToastItem[];
  currentDialog: DialogItem | null;
  showToast: (params: {
    type?: ToastType;
    title?: string;
    message: string;
    duration?: number;
  }) => void;
  hideToast: (id: string) => void;
  showDialog: (params: {
    title: string;
    message: string;
    buttons?: DialogButton[];
  }) => void;
  hideDialog: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  currentDialog: null,

  showToast: ({ type = 'info', title, message, duration = 3500 }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    set((state) => ({
      toasts: [...state.toasts.slice(-2), newToast], // Keep max 3 concurrent
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().hideToast(id);
      }, duration);
    }
  },

  hideToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  showDialog: ({ title, message, buttons = [{ text: 'OK', style: 'default' }] }) => {
    const id = `dialog_${Date.now()}`;
    set({
      currentDialog: { id, title, message, buttons },
    });
  },

  hideDialog: () => {
    set({ currentDialog: null });
  },
}));

/**
 * Convenient drop-in helper matching Alert.alert signature
 */
export const showThemedAlert = (
  title: string,
  message?: string,
  buttons?: DialogButton[]
) => {
  if (!buttons || buttons.length <= 1) {
    // Determine type from title
    const lower = (title + ' ' + (message || '')).toLowerCase();
    let type: ToastType = 'info';
    if (lower.includes('error') || lower.includes('fail')) {
      type = 'error';
    } else if (lower.includes('success') || lower.includes('saved') || lower.includes('connected') || lower.includes('completed')) {
      type = 'success';
    } else if (lower.includes('warning') || lower.includes('permission') || lower.includes('access')) {
      type = 'warning';
    }

    useNotificationStore.getState().showToast({
      type,
      title: title || undefined,
      message: message || title,
    });

    if (buttons && buttons[0]?.onPress) {
      buttons[0].onPress();
    }
  } else {
    // Multi-button confirmation dialog
    useNotificationStore.getState().showDialog({
      title,
      message: message || '',
      buttons,
    });
  }
};
