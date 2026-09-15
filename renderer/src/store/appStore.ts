import { create } from 'zustand';
import type { BrowseSlice } from './slices/browseSlice';
import type { CatalogSlice } from './slices/catalogSlice';
import type { DownloadSlice } from './slices/downloadSlice';
import type { SettingsSlice } from './slices/settingsSlice';
import type { UiSlice } from './slices/uiSlice';
import { createBrowseSlice } from './slices/browseSlice';
import { createCatalogSlice } from './slices/catalogSlice';
import { createDownloadSlice } from './slices/downloadSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createUiSlice } from './slices/uiSlice';
import { defaultSettings } from './slices/shared';

export type AppState = BrowseSlice & CatalogSlice & DownloadSlice & SettingsSlice & UiSlice;

export { defaultSettings };

export const useAppStore = create<AppState>()((...args) => ({
  ...createBrowseSlice(...args),
  ...createCatalogSlice(...args),
  ...createDownloadSlice(...args),
  ...createSettingsSlice(...args),
  ...createUiSlice(...args),
}));
