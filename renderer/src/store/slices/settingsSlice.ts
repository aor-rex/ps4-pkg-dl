import type { StateCreator } from 'zustand';
import type { Settings } from '../../types';
import type { AppState } from '../appStore';
import { backend, tryLive, httpApi } from '../../lib/backend';
import { defaultSettings } from './shared';

export interface SettingsSlice {
  settings: Settings;
  setSettings: (settings: Partial<Settings>) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsCategory: string;
  setSettingsCategory: (category: string) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set, get) => ({
  settings: defaultSettings,
  setSettings: (newSettings) => {
    set((state) => ({ settings: { ...state.settings, ...newSettings } as Settings }));
    if (backend) void tryLive((api) => api.updateSettings(newSettings as Record<string, unknown>));
    else if (get().backendMode === 'http') void httpApi.updateSettings(newSettings as Record<string, unknown>).catch(() => {});
  },
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  settingsCategory: 'general',
  setSettingsCategory: (settingsCategory) => set({ settingsCategory }),
});
