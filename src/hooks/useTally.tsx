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
import { Alert, AppState } from 'react-native';

import {
  appendSession,
  loadTally,
  savePrefs,
  saveTimer,
  updateSession as updateSessionRecord,
} from '../storage/tallyStorage';
import type {
  CategoryId,
  Session,
  TimerPrefill,
  TimerState,
} from '../types';
import { createId } from '../utils/id';

interface TallyContextValue {
  hydrated: boolean;
  busy: boolean;
  timer: TimerState;
  sessions: Session[];
  lastCategory: CategoryId;
  elapsedMs: number;
  start: (prefill?: TimerPrefill) => Promise<boolean>;
  stop: () => Promise<void>;
  savePending: (activity: string, category: CategoryId) => Promise<boolean>;
  discardPending: () => Promise<void>;
  updateSession: (
    id: string,
    activity: string,
    category: CategoryId,
  ) => Promise<boolean>;
}

const TallyContext = createContext<TallyContextValue | null>(null);

export function TallyProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [timer, setTimer] = useState<TimerState>({ status: 'idle' });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastCategory, setLastCategory] = useState<CategoryId>('other');
  const [now, setNow] = useState(() => Date.now());

  // Hydrate once. If storage is corrupt, loadTally falls back to safe defaults.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loaded = await loadTally().catch((error: unknown) => {
        console.warn('[tally] load failed', error);
        return null;
      });

      if (cancelled) return;

      if (loaded) {
        setSessions(loaded.sessions);
        setTimer(loaded.timer);
        setLastCategory(loaded.prefs.lastCategory);
      }
      setNow(Date.now());
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const runningStartedAt = timer.status === 'running' ? timer.startedAt : 0;

  // The interval only drives re-renders. Elapsed time is always derived from
  // wall-clock timestamps, so background throttling cannot corrupt a session.
  useEffect(() => {
    if (timer.status !== 'running') return;

    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [timer.status, runningStartedAt]);

  const elapsedMs = useMemo(() => {
    if (timer.status === 'running') return Math.max(0, now - timer.startedAt);
    if (timer.status === 'pending') {
      return Math.max(0, timer.endedAt - timer.startedAt);
    }
    return 0;
  }, [timer, now]);

  const start = useCallback(
    async (prefill?: TimerPrefill): Promise<boolean> => {
      if (!hydrated || busyRef.current || timer.status !== 'idle') {
        return false;
      }

      busyRef.current = true;
      setBusy(true);

      const activity = prefill?.activity.trim() ?? '';
      const snapshot =
        prefill && activity
          ? {
              planId: prefill.planId,
              activity,
              category: prefill.category,
            }
          : null;
      const startedAt = Date.now();
      const next: TimerState = {
        status: 'running',
        id: createId(),
        startedAt,
        ...(snapshot ? { prefill: snapshot } : {}),
      };

      try {
        await saveTimer(next);
        setTimer(next);
        setNow(Date.now());
        return true;
      } catch (error) {
        console.warn('[tally] start failed', error);
        Alert.alert('无法开始计时', '数据保存失败，请重试。');
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated, timer.status],
  );

  const stop = useCallback(async () => {
    if (!hydrated || busyRef.current || timer.status !== 'running') return;

    busyRef.current = true;
    setBusy(true);

    const endedAt = Math.max(Date.now(), timer.startedAt);
    const next: TimerState = {
      status: 'pending',
      id: timer.id,
      startedAt: timer.startedAt,
      endedAt,
      ...(timer.prefill ? { prefill: timer.prefill } : {}),
    };

    try {
      await saveTimer(next);
      setTimer(next);
    } catch (error) {
      console.warn('[tally] stop failed', error);
      Alert.alert('无法结束计时', '数据保存失败，请重试。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [hydrated, timer]);

  const savePending = useCallback(
    async (activity: string, category: CategoryId): Promise<boolean> => {
      if (busyRef.current || timer.status !== 'pending') return false;

      const trimmed = activity.trim();
      if (!trimmed) return false;

      busyRef.current = true;
      setBusy(true);

      const pending = timer;
      const session: Session = {
        id: pending.id,
        activity: trimmed,
        category,
        startedAt: pending.startedAt,
        endedAt: pending.endedAt,
        createdAt: Date.now(),
      };

      try {
        const nextSessions = await appendSession(session);
        setSessions(nextSessions);

        // The session is already safe; clearing the timer is the last step.
        // If this fails, the modal stays open and recovery/retry is idempotent.
        await saveTimer({ status: 'idle' });
        setTimer({ status: 'idle' });
        setLastCategory(category);
        savePrefs({ lastCategory: category }).catch((error: unknown) => {
          console.warn('[tally] prefs save failed', error);
        });
        return true;
      } catch (error) {
        console.warn('[tally] save failed', error);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [timer],
  );

  const discardPending = useCallback(async () => {
    if (busyRef.current || timer.status !== 'pending') return;

    busyRef.current = true;
    setBusy(true);

    try {
      await saveTimer({ status: 'idle' });
      setTimer({ status: 'idle' });
    } catch (error) {
      console.warn('[tally] discard failed', error);
      Alert.alert('无法丢弃记录', '数据保存失败，请重试。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [timer]);

  const updateSession = useCallback(
    async (
      id: string,
      activity: string,
      category: CategoryId,
    ): Promise<boolean> => {
      if (!hydrated || busyRef.current) return false;

      const trimmed = activity.trim();
      if (!trimmed) return false;

      busyRef.current = true;
      setBusy(true);

      try {
        const next = await updateSessionRecord(id, trimmed, category);
        if (!next) return false;
        setSessions(next);
        return true;
      } catch (error) {
        console.warn('[tally] update session failed', error);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hydrated],
  );

  const value = useMemo<TallyContextValue>(
    () => ({
      hydrated,
      busy,
      timer,
      sessions,
      lastCategory,
      elapsedMs,
      start,
      stop,
      savePending,
      discardPending,
      updateSession,
    }),
    [
      hydrated,
      busy,
      timer,
      sessions,
      lastCategory,
      elapsedMs,
      start,
      stop,
      savePending,
      discardPending,
      updateSession,
    ],
  );

  return <TallyContext.Provider value={value}>{children}</TallyContext.Provider>;
}

export function useTally(): TallyContextValue {
  const context = useContext(TallyContext);
  if (!context) {
    throw new Error('useTally must be used within TallyProvider');
  }
  return context;
}
