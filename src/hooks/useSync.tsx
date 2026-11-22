import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { replaceSessions, savePrefs } from '../storage/tallyStorage';
import { replacePlanItems, savePlanPrefs } from '../storage/planStorage';
import { replaceCategories } from '../storage/categoryStorage';
import {
  loadTombstones,
  saveTombstones,
} from '../storage/tombstoneStorage';
import {
  DEFAULT_SYNC_CONFIG,
  clearSyncSecrets,
  loadSyncConfig,
  loadSyncSecrets,
  saveSyncConfig,
  saveSyncSecrets,
  type SyncConfig,
  type SyncSecrets,
} from '../storage/syncStorage';
import {
  createSaltBase64,
  decryptSnapshot,
  deriveKeyHex,
  encryptSnapshot,
  parseEnvelope,
} from '../sync/crypto';
import { mergeSnapshots } from '../sync/merge';
import { getFile, putFile, WebdavError } from '../sync/webdav';
import { buildSnapshot, isTallySnapshot } from '../utils/snapshot';
import type { TallySnapshot } from '../utils/snapshot';
import { useCategories } from './useCategories';
import { usePlans } from './usePlans';
import { useTally } from './useTally';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface ConnectInput {
  serverUrl: string;
  username: string;
  appPassword: string;
  syncPassword: string;
  remotePath: string;
}

interface SyncContextValue {
  hydrated: boolean;
  configured: boolean;
  config: SyncConfig;
  status: SyncStatus;
  error: string | null;
  connect: (input: ConnectInput) => Promise<boolean>;
  syncNow: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setAutoSync: (value: boolean) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const {
    hydrated: tallyHydrated,
    sessions,
    lastCategory,
    reload: reloadTally,
  } = useTally();
  const {
    hydrated: plansHydrated,
    items: plans,
    prefs: planPrefs,
    reload: reloadPlans,
  } = usePlans();
  const {
    hydrated: categoriesHydrated,
    categories,
    reloadCategories,
  } = useCategories();

  const [hydrated, setHydrated] = useState(false);
  const [config, setConfig] = useState<SyncConfig>({
    ...DEFAULT_SYNC_CONFIG,
  });
  const [hasSecrets, setHasSecrets] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const runningRef = useRef(false);
  const autoRanRef = useRef(false);
  const configRef = useRef(config);
  const secretsRef = useRef<SyncSecrets | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedConfig, loadedSecrets] = await Promise.all([
        loadSyncConfig(),
        loadSyncSecrets(),
      ]);
      if (cancelled) return;
      const nextConfig =
        loadedSecrets === null
          ? { ...loadedConfig, enabled: false }
          : loadedConfig;
      setConfig(nextConfig);
      configRef.current = nextConfig;
      secretsRef.current = loadedSecrets;
      setHasSecrets(loadedSecrets !== null);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildLocal = useCallback(async (): Promise<TallySnapshot> => {
    const tombstones = await loadTombstones();
    return buildSnapshot({
      categories,
      sessions,
      plans,
      prefs: { lastCategory },
      planPrefs,
      tombstones,
    });
  }, [categories, lastCategory, planPrefs, plans, sessions]);

  const applySnapshot = useCallback(
    async (snapshot: TallySnapshot) => {
      await replaceCategories(snapshot.categories);
      await replaceSessions(snapshot.sessions);
      await replacePlanItems(snapshot.plans);
      await savePrefs(snapshot.prefs);
      await savePlanPrefs(snapshot.planPrefs);
      await saveTombstones(snapshot.tombstones);
      await Promise.all([
        reloadTally(),
        reloadPlans(),
        reloadCategories(),
      ]);
    },
    [reloadCategories, reloadPlans, reloadTally],
  );

  const saveConfigState = useCallback(async (next: SyncConfig) => {
    setConfig(next);
    configRef.current = next;
    await saveSyncConfig(next);
  }, []);

  const handleError = useCallback((cause: unknown) => {
    const message =
      cause instanceof WebdavError
        ? cause.message
        : cause instanceof Error && cause.message
          ? cause.message
          : '同步失败，请检查网络后重试';
    setError(message);
    setStatus('error');
    return false;
  }, []);

  const runSync = useCallback(
    async (
      secrets: SyncSecrets,
      retry = 0,
    ): Promise<boolean | 'retry'> => {
      const current = configRef.current;
      const credentials = {
        serverUrl: current.serverUrl,
        username: current.username,
        appPassword: secrets.appPassword,
      };
      const local = await buildLocal();
      const remote = await getFile(credentials, current.remotePath);

      if (remote.status === 404) {
        const envelope = await encryptSnapshot(
          local,
          secrets.keyHex,
          secrets.saltBase64,
        );
        const result = await putFile(
          credentials,
          current.remotePath,
          JSON.stringify(envelope),
          { createOnly: true },
        );
        await saveConfigState({
          ...current,
          enabled: true,
          lastSyncAt: Date.now(),
          lastEtag: result.etag ?? null,
        });
        setStatus('success');
        setError(null);
        return true;
      }

      if (!remote.body) throw new Error('云端同步文件为空');
      const envelope = parseEnvelope(JSON.parse(remote.body) as unknown);
      const remoteSnapshot = await decryptSnapshot(
        envelope,
        secrets.keyHex,
      );
      if (!isTallySnapshot(remoteSnapshot)) {
        throw new Error('云端同步数据格式不正确');
      }
      const merged = mergeSnapshots(local, remoteSnapshot).snapshot;
      await applySnapshot(merged);
      const nextEnvelope = await encryptSnapshot(
        merged,
        secrets.keyHex,
        envelope.kdf.salt,
        envelope.kdf.iterations,
      );
      let result: { etag?: string };
      try {
        result = await putFile(
          credentials,
          current.remotePath,
          JSON.stringify(nextEnvelope),
          { etag: remote.etag },
        );
      } catch (cause) {
        if (
          retry < 1 &&
          cause instanceof WebdavError &&
          cause.status === 412
        ) {
          return 'retry';
        }
        throw cause;
      }
      await saveConfigState({
        ...current,
        enabled: true,
        lastSyncAt: Date.now(),
        lastEtag: result.etag ?? remote.etag ?? null,
      });
      setStatus('success');
      setError(null);
      return true;
    },
    [applySnapshot, buildLocal, saveConfigState],
  );

  const syncNow = useCallback(async (): Promise<boolean> => {
    if (runningRef.current) return false;
    if (!tallyHydrated || !plansHydrated || !categoriesHydrated) {
      setError('数据仍在加载，请稍后重试');
      setStatus('error');
      return false;
    }
    const secrets = secretsRef.current;
    if (!configRef.current.enabled || !secrets) {
      setError('请先完成坚果云同步设置');
      setStatus('error');
      return false;
    }

    runningRef.current = true;
    setStatus('syncing');
    setError(null);
    try {
      const first = await runSync(secrets);
      if (first !== 'retry') return first;
      // The remote file changed between GET and PUT. Re-pull and merge once.
      const second = await runSync(secrets, 1);
      return second === true;
    } catch (cause) {
      return handleError(cause);
    } finally {
      runningRef.current = false;
    }
  }, [
    categoriesHydrated,
    handleError,
    plansHydrated,
    runSync,
    tallyHydrated,
  ]);

  const connect = useCallback(
    async (input: ConnectInput): Promise<boolean> => {
      if (runningRef.current) return false;
      if (!tallyHydrated || !plansHydrated || !categoriesHydrated) {
        setError('数据仍在加载，请稍后重试');
        setStatus('error');
        return false;
      }
      if (input.syncPassword.length < 8) {
        setError('同步密码至少需要 8 位');
        setStatus('error');
        return false;
      }
      runningRef.current = true;
      setStatus('syncing');
      setError(null);
      try {
        const credentials = {
          serverUrl: input.serverUrl.trim(),
          username: input.username.trim(),
          appPassword: input.appPassword.trim(),
        };
        const remotePath =
          input.remotePath.trim() || DEFAULT_SYNC_CONFIG.remotePath;
        const local = await buildLocal();
        const remote = await getFile(credentials, remotePath);

        let keyHex: string;
        let saltBase64: string;
        let nextSnapshot = local;
        let etag: string | undefined;

        if (remote.status === 404) {
          saltBase64 = createSaltBase64();
          keyHex = await deriveKeyHex(input.syncPassword, saltBase64);
        } else {
          if (!remote.body) throw new Error('云端同步文件为空');
          const envelope = parseEnvelope(
            JSON.parse(remote.body) as unknown,
          );
          saltBase64 = envelope.kdf.salt;
          keyHex = await deriveKeyHex(
            input.syncPassword,
            saltBase64,
            envelope.kdf.iterations,
          );
          let remoteSnapshot: TallySnapshot;
          try {
            remoteSnapshot = await decryptSnapshot(envelope, keyHex);
          } catch {
            throw new Error('同步密码不正确，或云端文件已损坏');
          }
          if (!isTallySnapshot(remoteSnapshot)) {
            throw new Error('云端同步数据格式不正确');
          }
          nextSnapshot = mergeSnapshots(local, remoteSnapshot).snapshot;
          etag = remote.etag;
        }

        if (remote.status !== 404) {
          await applySnapshot(nextSnapshot);
        }
        const nextEnvelope = await encryptSnapshot(
          nextSnapshot,
          keyHex,
          saltBase64,
        );
        const result = await putFile(
          credentials,
          remotePath,
          JSON.stringify(nextEnvelope),
          remote.status === 404
            ? { createOnly: true }
            : { etag },
        );

        const secrets: SyncSecrets = {
          appPassword: credentials.appPassword,
          keyHex,
          saltBase64,
        };
        await saveSyncSecrets(secrets);
        secretsRef.current = secrets;
        setHasSecrets(true);
        await saveConfigState({
          enabled: true,
          serverUrl: credentials.serverUrl,
          username: credentials.username,
          remotePath,
          autoSync: true,
          lastSyncAt: Date.now(),
          lastEtag: result.etag ?? etag ?? null,
        });
        autoRanRef.current = true;
        setStatus('success');
        setError(null);
        return true;
      } catch (cause) {
        return handleError(cause);
      } finally {
        runningRef.current = false;
      }
    },
    [
      applySnapshot,
      buildLocal,
      categoriesHydrated,
      handleError,
      plansHydrated,
      saveConfigState,
      tallyHydrated,
    ],
  );

  const disconnect = useCallback(async () => {
    await clearSyncSecrets();
    secretsRef.current = null;
    setHasSecrets(false);
    await saveConfigState({
      ...DEFAULT_SYNC_CONFIG,
      enabled: false,
    });
    setStatus('idle');
    setError(null);
  }, [saveConfigState]);

  const setAutoSync = useCallback(
    async (value: boolean) => {
      await saveConfigState({ ...configRef.current, autoSync: value });
    },
    [saveConfigState],
  );

  useEffect(() => {
    if (
      !hydrated ||
      !tallyHydrated ||
      !plansHydrated ||
      !categoriesHydrated ||
      !config.enabled ||
      !config.autoSync ||
      !hasSecrets ||
      autoRanRef.current
    ) {
      return;
    }
    autoRanRef.current = true;
    void syncNow();
  }, [
    hydrated,
    tallyHydrated,
    plansHydrated,
    categoriesHydrated,
    config.enabled,
    config.autoSync,
    hasSecrets,
    syncNow,
  ]);

  useEffect(() => {
    if (!config.enabled || !config.autoSync || !hasSecrets) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const last = configRef.current.lastSyncAt ?? 0;
      if (Date.now() - last < 5 * 60 * 1000) return;
      void syncNow();
    });
    return () => subscription.remove();
  }, [config.enabled, config.autoSync, hasSecrets, syncNow]);

  const value = useMemo<SyncContextValue>(
    () => ({
      hydrated,
      configured: config.enabled && hasSecrets,
      config,
      status,
      error,
      connect,
      syncNow,
      disconnect,
      setAutoSync,
    }),
    [
      hydrated,
      config,
      hasSecrets,
      status,
      error,
      connect,
      syncNow,
      disconnect,
      setAutoSync,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside SyncProvider');
  return value;
}
