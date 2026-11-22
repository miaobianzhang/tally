import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '../types';
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

export const DEFAULT_PROFILE: Profile = {
  displayName: 'Tally 用户',
  avatarUri: null,
  updatedAt: 0,
};

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_PROFILE.displayName;
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 20);
  return name || DEFAULT_PROFILE.displayName;
}

export function normalizeProfile(value: unknown): Profile {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_PROFILE };
  const record = value as Record<string, unknown>;
  const displayName = normalizeDisplayName(record.displayName);
  const avatarUri =
    typeof record.avatarUri === 'string' && record.avatarUri.length > 0
      ? record.avatarUri
      : null;
  const updatedAt =
    typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : 0;

  return { displayName, avatarUri, updatedAt };
}

export async function loadProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.profile);
    if (raw == null) return { ...DEFAULT_PROFILE };
    return normalizeProfile(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[tally] failed to read profile', error);
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfile(profile: Profile): Promise<Profile> {
  return enqueue(async () => {
    const normalized = normalizeProfile(profile);
    await AsyncStorage.setItem(
      STORAGE_KEYS.profile,
      JSON.stringify(normalized),
    );
    return normalized;
  });
}
