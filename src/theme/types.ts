export type ThemeMode = 'system' | 'light' | 'dark';

export type BackgroundKind = 'theme' | 'preset' | 'image';

export interface BackgroundPref {
  kind: BackgroundKind;
  presetId?: string;
  imageUri?: string | null;
  /** 0.15–1; controls the photo itself, independent of the preset scrim. */
  imageOpacity: number;
  scrim?: number;
}

export interface AppearancePrefs {
  version: 1;
  mode: ThemeMode;
  pageColor: string | null;
  surfaceColor: string | null;
  accentColor: string | null;
  background: BackgroundPref;
  updatedAt: number;
}

export interface ThemeColors {
  page: string;
  surface: string;
  surfaceOpaque: string;
  text: string;
  textOnPage: string;
  textSecondary: string;
  textSecondaryOnPage: string;
  muted: string;
  mutedOnPage: string;
  border: string;
  axis: string;
  rangeTint: string;
  accent: string;
  onAccent: string;
  danger: string;
  running: string;
  overlay: string;
  isDark: boolean;
}

export interface ThemeValue {
  colors: ThemeColors;
  mode: 'light' | 'dark';
  prefs: AppearancePrefs;
  background: BackgroundPref;
  setMode: (mode: ThemeMode) => Promise<boolean>;
  setColor: (
    key: 'pageColor' | 'surfaceColor' | 'accentColor',
    color: string | null,
  ) => Promise<boolean>;
  setBackground: (background: BackgroundPref) => Promise<boolean>;
  resetAppearance: () => Promise<boolean>;
  hydrated: boolean;
}
