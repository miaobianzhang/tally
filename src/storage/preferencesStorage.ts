import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_APPEARANCE, getBackgroundPreset } from '../theme/presets';
import type {
  AppearancePrefs,
  BackgroundKind,
  ThemeMode,
} from '../theme/types';
import { STORAGE_KEYS } from './keys';

let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeChain.then(task, task);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeColor(value: unknown): string | null {
  return isHex(value) ? value.toUpperCase() : null;
}

function normalizeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_APPEARANCE.mode;
}

function normalizeKind(value: unknown): BackgroundKind {
  return value === 'preset' || value === 'image' ? value : 'theme';
}

export function normalizeAppearancePrefs(value: unknown): AppearancePrefs {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_APPEARANCE };
  }
  const record = value as Record<string, unknown>;
  const rawBackground =
    typeof record.background === 'object' && record.background !== null
      ? (record.background as Record<string, unknown>)
      : {};
  const kind = normalizeKind(rawBackground.kind);
  const presetId =
    typeof rawBackground.presetId === 'string' &&
    getBackgroundPreset(rawBackground.presetId)
      ? rawBackground.presetId
      : undefined;
  const imageUri =
    typeof rawBackground.imageUri === 'string' &&
    rawBackground.imageUri.length > 0
      ? rawBackground.imageUri
      : null;
  const scrim =
    typeof rawBackground.scrim === 'number' &&
    Number.isFinite(rawBackground.scrim)
      ? Math.max(0.2, Math.min(0.6, rawBackground.scrim))
      : 0.4;

  const updatedAt =
    typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : 0;

  return {
    version: 1,
    mode: normalizeMode(record.mode),
    pageColor: normalizeColor(record.pageColor),
    surfaceColor: normalizeColor(record.surfaceColor),
    accentColor: normalizeColor(record.accentColor),
    background: {
      kind,
      presetId,
      imageUri,
      scrim,
    },
    updatedAt,
  };
}

export async function loadAppearance(): Promise<AppearancePrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.appearance);
    if (raw == null) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearancePrefs(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[tally] failed to read appearance', error);
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(
  prefs: AppearancePrefs,
): Promise<AppearancePrefs> {
  return enqueue(async () => {
    const normalized = normalizeAppearancePrefs(prefs);
    await AsyncStorage.setItem(
      STORAGE_KEYS.appearance,
      JSON.stringify(normalized),
    );
    return normalized;
  });
}
