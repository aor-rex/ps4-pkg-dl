import type { StateCreator } from 'zustand';
import type { Mirror } from '../../types';
import type { AppState } from '../appStore';
import { backend, tryLive } from '../../lib/backend';

export interface UiSlice {
  mirrorModalOpen: boolean;
  setMirrorModalOpen: (open: boolean) => void;
  selectedMirrors: Mirror[];
  setSelectedMirrors: (mirrors: Mirror[]) => void;
  rememberedMirrorHost: string | null;
  setRememberedMirrorHost: (host: string | null) => void;
  lightboxOpen: boolean;
  setLightboxOpen: (open: boolean) => void;
  lightboxImages: string[];
  setLightboxImages: (images: string[]) => void;
  lightboxIndex: number;
  setLightboxIndex: (index: number) => void;
  videoModalOpen: boolean;
  setVideoModalOpen: (open: boolean) => void;
  selectedVideo: { url: string; title: string } | null;
  setSelectedVideo: (video: { url: string; title: string } | null) => void;
  confirmDialogOpen: boolean;
  setConfirmDialogOpen: (open: boolean) => void;
  confirmDialogMessage: string;
  setConfirmDialogMessage: (message: string) => void;
  confirmDialogOnConfirm: (() => void) | null;
  setConfirmDialogOnConfirm: (fn: (() => void) | null) => void;
  whatsNewOpen: boolean;
  setWhatsNewOpen: (open: boolean) => void;
  maybeShowWhatsNew: () => void;
  updateStatus:
    'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'stalled' | 'error' | 'unavailable';
  updateVersion: string | null;
  updateProgress: number;
  updateTransferred: number;
  updateTotal: number;
  updateError: string | null;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  restartToUpdate: () => Promise<void>;
  toasts: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string; at: number }>;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: string) => void;
  notificationHistory: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string; at: number }>;
  unreadNotifications: number;
  markNotificationsRead: () => void;
  clearNotificationHistory: () => void;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
  mirrorModalOpen: false,
  setMirrorModalOpen: (mirrorModalOpen) => set({ mirrorModalOpen }),
  selectedMirrors: [],
  setSelectedMirrors: (selectedMirrors) => set({ selectedMirrors }),
  rememberedMirrorHost: null,
  setRememberedMirrorHost: (rememberedMirrorHost) => set({ rememberedMirrorHost }),
  lightboxOpen: false,
  setLightboxOpen: (lightboxOpen) => set({ lightboxOpen }),
  lightboxImages: [],
  setLightboxImages: (lightboxImages) => set({ lightboxImages }),
  lightboxIndex: 0,
  setLightboxIndex: (lightboxIndex) => set({ lightboxIndex }),
  videoModalOpen: false,
  setVideoModalOpen: (videoModalOpen) => set({ videoModalOpen }),
  selectedVideo: null,
  setSelectedVideo: (selectedVideo) => set({ selectedVideo }),
  confirmDialogOpen: false,
  setConfirmDialogOpen: (confirmDialogOpen) => set({ confirmDialogOpen }),
  confirmDialogMessage: '',
  setConfirmDialogMessage: (confirmDialogMessage) => set({ confirmDialogMessage }),
  confirmDialogOnConfirm: null,
  setConfirmDialogOnConfirm: (confirmDialogOnConfirm) => set({ confirmDialogOnConfirm }),

  whatsNewOpen: false,
  setWhatsNewOpen: (whatsNewOpen) => set({ whatsNewOpen }),
  maybeShowWhatsNew: () => {
    let version = '';
    try {
      version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
    } catch {
      return;
    }
    if (!version) return;
    const key = `seen-changelog-${version}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    set({ whatsNewOpen: true });
  },

  updateStatus: 'idle',
  updateVersion: null,
  updateProgress: 0,
  updateTransferred: 0,
  updateTotal: 0,
  updateError: null,
  checkForUpdates: async (manual = false) => {
    const { addToast } = get();
    if (!backend) {
      if (manual) addToast('info', 'Auto-update is available in the desktop app (or re-run install.sh)');
      set({ updateStatus: 'unavailable' });
      return;
    }
    set({ updateStatus: 'checking', updateError: null });
    const res = (await tryLive((api) => api.updateCheck())) as {
      status?: string;
      available?: boolean;
      version?: string | null;
      current?: string | null;
      error?: string;
    } | null;
    if (!res || res.status === 'unavailable') {
      set({ updateStatus: 'unavailable' });
      if (manual) addToast('info', 'Auto-update is unavailable in this build');
      return;
    }
    if (res.status === 'error') {
      set({ updateStatus: 'error', updateError: res.error || 'check failed' });
      if (manual) addToast('error', `Update check failed: ${res.error || 'unknown'}`);
      return;
    }
    // Belt and braces: only a strictly-newer version counts as an offer.
    // Never offer the running version (or an older one) for download.
    let current = res.current || null;
    try {
      current = current || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null);
    } catch {
      /* ignore */
    }
    const newer = !!(
      res.available &&
      res.version &&
      current &&
      res.version !== current &&
      res.version !== `v${current}`
    );
    if (newer) {
      set({ updateStatus: 'available', updateVersion: res.version || null });
      if (manual) set({ whatsNewOpen: false });
    } else {
      set({ updateStatus: 'idle', updateVersion: null });
      if (manual) addToast('success', 'Already on the latest version');
    }
  },
  downloadUpdate: async () => {
    const { addToast, updateVersion } = get();
    if (!backend) return;
    // Never attempt a download unless a strictly-newer version is staged
    if (!updateVersion) {
      set({ updateStatus: 'idle', updateError: null });
      addToast('info', 'No update available to download — check for updates first');
      return;
    }
    set({ updateStatus: 'downloading', updateProgress: 0 });
    const res = (await tryLive((api) => api.updateDownload())) as { status?: string; error?: string } | null;
    if (!res || res.status === 'error') {
      set({
        updateStatus: 'idle',
        updateVersion: null,
        updateProgress: 0,
        updateError: (res && res.error) || 'download failed',
      });
      addToast('error', `Update download failed: ${(res && res.error) || 'unknown'}`);
    }
  },
  restartToUpdate: async () => {
    if (!backend) return;
    await tryLive((api) => api.updateQuit());
  },

  toasts: [],
  notificationHistory: [],
  unreadNotifications: 0,
  markNotificationsRead: () => set({ unreadNotifications: 0 }),
  clearNotificationHistory: () => set({ notificationHistory: [], unreadNotifications: 0 }),
  addToast: (type, message) =>
    set((state) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry = { id, type, message, at: Date.now() };
      const newToasts = [...state.toasts, entry];
      const history = [...state.notificationHistory, entry].slice(-50);
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 5000);
      return {
        toasts: newToasts,
        notificationHistory: history,
        unreadNotifications: state.unreadNotifications + 1,
      };
    }),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
});
