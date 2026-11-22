import type { AppearancePrefs } from './types';

export const LIGHT_BASE = {
  page: '#F9F9F7',
  surface: '#FCFCFB',
  accent: '#0B0B0B',
} as const;

export const DARK_BASE = {
  page: '#0F0F0E',
  surface: '#181816',
  accent: '#F5F5F2',
} as const;

export interface BackgroundPreset {
  id: string;
  label: string;
  light: readonly [string, string, string];
  dark: readonly [string, string, string];
}

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  {
    id: 'warm',
    label: '暖白',
    light: ['#FDF8EE', '#F8EFDD', '#F4E6CF'],
    dark: ['#2B2118', '#1B1510', '#110D09'],
  },
  {
    id: 'mist',
    label: '晨雾',
    light: ['#F1F6F3', '#E3ECE8', '#D8E4DF'],
    dark: ['#17221F', '#101815', '#0A100E'],
  },
  {
    id: 'dusk',
    label: '暮色',
    light: ['#F5ECF4', '#EBDDEB', '#DED0E2'],
    dark: ['#261B28', '#18101A', '#0F0A11'],
  },
];

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  version: 1,
  mode: 'system',
  pageColor: null,
  surfaceColor: null,
  accentColor: null,
  background: { kind: 'theme' },
  updatedAt: 0,
};

export function getBackgroundPreset(
  id: string | undefined,
): BackgroundPreset | null {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id) ?? null;
}
