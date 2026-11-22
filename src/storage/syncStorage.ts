import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { createId } from '../utils/id';
import { STORAGE_KEYS } from './keys';

export interface SyncConfig {
  enabled: boolean;
  serverUrl: string;
  username: string;
  remotePath: string;
  autoSync: boolean;
  lastSyncAt: number | null;
  lastEtag: string | null;
}

export interface SyncSecrets {
  appPassword: string;
  keyHex: string;
  saltBase64: string;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  serverUrl: 'https://dav.jianguoyun.com/dav/',
  username: '',
  remotePath: 'Tally/tally-sync.json',
  autoSync: true,
  lastSyncAt: null,
  lastEtag: null,
};

const SECRET_KEYS = {
  appPassword: 'tally.webdav.appPassword',
  keyHex: 'tally.sync.keyHex',
  salt: 'tally.sync.salt',
} as const;

export function normalizeSyncConfig(value: unknown): SyncConfig {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_SYNC_CONFIG };
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    serverUrl:
      typeof record.serverUrl === 'string' && record.serverUrl.length > 0
        ? record.serverUrl
        : DEFAULT_SYNC_CONFIG.serverUrl,
    username:
      typeof record.username === 'string' ? record.username : '',
    remotePath:
      typeof record.remotePath === 'string' &&
      record.remotePath.length > 0
        ? record.remotePath
        : DEFAULT_SYNC_CONFIG.remotePath,
    autoSync: record.autoSync !== false,
    lastSyncAt:
      typeof record.lastSyncAt === 'number' ? record.lastSyncAt : null,
    lastEtag:
      typeof record.lastEtag === 'string' ? record.lastEtag : null,
  };
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.syncConfig);
    if (raw == null) return { ...DEFAULT_SYNC_CONFIG };
    return normalizeSyncConfig(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[tally] failed to read sync config', error);
    return { ...DEFAULT_SYNC_CONFIG };
  }
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.syncConfig,
    JSON.stringify(config),
  );
}

export async function loadSyncSecrets(): Promise<SyncSecrets | null> {
  try {
    const [appPassword, keyHex, saltBase64] = await Promise.all([
      SecureStore.getItemAsync(SECRET_KEYS.appPassword),
      SecureStore.getItemAsync(SECRET_KEYS.keyHex),
      SecureStore.getItemAsync(SECRET_KEYS.salt),
    ]);
    if (!appPassword || !keyHex || !saltBase64) return null;
    return { appPassword, keyHex, saltBase64 };
  } catch (error) {
    console.warn('[tally] failed to read sync secrets', error);
    return null;
  }
}

export async function saveSyncSecrets(secrets: SyncSecrets): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECRET_KEYS.appPassword, secrets.appPassword),
    SecureStore.setItemAsync(SECRET_KEYS.keyHex, secrets.keyHex),
    SecureStore.setItemAsync(SECRET_KEYS.salt, secrets.saltBase64),
  ]);
}

export async function clearSyncSecrets(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECRET_KEYS.appPassword),
    SecureStore.deleteItemAsync(SECRET_KEYS.keyHex),
    SecureStore.deleteItemAsync(SECRET_KEYS.salt),
  ]);
}

export async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.deviceId);
    if (existing) return existing;
    const id = createId();
    await AsyncStorage.setItem(STORAGE_KEYS.deviceId, id);
    return id;
  } catch {
    return createId();
  }
}
