import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isCategoryId,
  type Prefs,
  type Session,
  type TimerState,
} from '../types';
import { applySessionUpdate } from '../utils/sessionUpdate';
import {
  isTimerState,
  sanitizeTimerState,
} from '../utils/timerState';
import { STORAGE_KEYS } from './keys';

const DEFAULT_PREFS: Prefs = { lastCategory: 'other' };

// AsyncStorage has no transactions, and concurrent setItem calls can resolve
// out of order. Every write goes through this promise chain.
let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeChain.then(task, task);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.activity === 'string' &&
    isCategoryId(value.category) &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.endedAt) &&
    isFiniteNumber(value.createdAt)
  );
}

function isPrefs(value: unknown): value is Prefs {
  return isRecord(value) && isCategoryId(value.lastCategory);
}

async function readJson<T>(
  key: string,
  guard: (value: unknown) => value is T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : fallback;
  } catch (error) {
    console.warn(`[tally] failed to read ${key}`, error);
    return fallback;
  }
}

async function readSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.sessions);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSession);
  } catch (error) {
    console.warn('[tally] failed to read sessions', error);
    return [];
  }
}

export interface LoadedTally {
  sessions: Session[];
  timer: TimerState;
  prefs: Prefs;
}

export async function loadTally(): Promise<LoadedTally> {
  const [sessions, loadedTimer, prefs] = await Promise.all([
    readSessions(),
    readJson<TimerState>(STORAGE_KEYS.timer, isTimerState, { status: 'idle' }),
    readJson<Prefs>(STORAGE_KEYS.prefs, isPrefs, DEFAULT_PREFS),
  ]);

  let timer = sanitizeTimerState(loadedTimer);

  if (timer.status === 'pending' && timer.endedAt < timer.startedAt) {
    timer = { ...timer, endedAt: timer.startedAt };
  }

  // A save can finish writing the session and be killed before clearing the
  // timer. If the pending id already exists, the record is already safe.
  if (timer.status === 'pending') {
    const pendingId = timer.id;
    if (sessions.some((session) => session.id === pendingId)) {
      timer = { status: 'idle' };
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.timer, JSON.stringify(timer));
      } catch (error) {
        console.warn('[tally] failed to reconcile timer', error);
      }
    }
  }

  return { sessions, timer, prefs };
}

export function saveTimer(timer: TimerState): Promise<void> {
  return enqueue(() =>
    AsyncStorage.setItem(STORAGE_KEYS.timer, JSON.stringify(timer)),
  );
}

export function savePrefs(prefs: Prefs): Promise<void> {
  return enqueue(() =>
    AsyncStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs)),
  );
}

/** Replaces an existing session's activity and category. */
export function updateSession(
  id: string,
  activity: string,
  category: Session['category'],
): Promise<Session[] | null> {
  return enqueue(async () => {
    const sessions = await readSessions();
    const next = applySessionUpdate(
      sessions,
      id,
      activity,
      category,
    );
    if (!next) return null;

    await AsyncStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify(next),
    );
    return next;
  });
}

/** Appends once per id; safe to retry after a partial save. */
export function appendSession(session: Session): Promise<Session[]> {
  return enqueue(async () => {
    const sessions = await readSessions();
    if (sessions.some((item) => item.id === session.id)) {
      return sessions;
    }
    const next = [...sessions, session];
    await AsyncStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(next));
    return next;
  });
}
