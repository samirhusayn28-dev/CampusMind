import { create } from 'zustand';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

interface NetworkStoreState {
  isConnected: boolean;
  isInternetReachable: boolean | null; // null = "unknown", not offline
  isOffline: boolean;
  checkConnection: () => Promise<boolean>;
  initNetworkListener: () => () => void;
}

export const useNetworkStore = create<NetworkStoreState>((set, get) => ({
  isConnected: true,
  isInternetReachable: null,
  isOffline: false,

  checkConnection: async () => {
    try {
      const state = await NetInfo.fetch();
      // isInternetReachable === null is treated as unknown, NOT offline
      const offline = state.isConnected === false || state.isInternetReachable === false;
      set({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        isOffline: offline,
      });
      return !offline;
    } catch {
      return !get().isOffline;
    }
  },

  initNetworkListener: () => {
    // 1. Native / General NetInfo listener
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      // Treat isInternetReachable === null as unknown, not offline
      const offline = state.isConnected === false || state.isInternetReachable === false;
      set({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        isOffline: offline,
      });
    });

    // 2. Web-only listeners guarded strictly by Platform.OS === 'web' and typeof window
    let handleWebOnline: (() => void) | null = null;
    let handleWebOffline: (() => void) | null = null;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      handleWebOnline = () => {
        set({ isConnected: true, isInternetReachable: true, isOffline: false });
      };
      handleWebOffline = () => {
        set({ isConnected: false, isInternetReachable: false, isOffline: true });
      };

      window.addEventListener('online', handleWebOnline);
      window.addEventListener('offline', handleWebOffline);
    }

    return () => {
      unsubscribeNetInfo();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (handleWebOnline) window.removeEventListener('online', handleWebOnline);
        if (handleWebOffline) window.removeEventListener('offline', handleWebOffline);
      }
    };
  },
}));
