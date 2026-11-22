import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Tombstones } from '../types';
import { STORAGE_KEYS } from './keys';

const EMPTY: Tombstones = { plans: {} };

let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeChain.then(task, task);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function normalizeTombstones(value: unknown): Tombstones {
  if (typeof value !== 'object' || value === null) return { plans: {} };
  const record = value as Record<string, unknown>;
  const rawPlans =
    typeof record.plans === 'object' && record.plans !== null
      ? (record.plans as Record<string, unknown>)
      : {};
  const plans: Record<string, number> = {};
  Object.entries(rawPlans).forEach(([id, deletedAt]) => {
    if (typeof deletedAt === 'number' && Number.isFinite(deletedAt)) {
      plans[id] = deletedAt;
    }
  });
  return { plans };
}

export async function loadTombstones(): Promise<Tombstones> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.tombstones);
    if (raw == null) return { plans: {} };
    return normalizeTombstones(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn('[tally] failed to read tombstones', error);
    return { plans: {} };
  }
}

export function saveTombstones(tombstones: Tombstones): Promise<void> {
  return enqueue(() =>
    AsyncStorage.setItem(
      STORAGE_KEYS.tombstones,
      JSON.stringify(tombstones),
    ),
  );
}

export function recordPlanTombstone(id: string): Promise<void> {
  return enqueue(async () => {
    const current = await loadTombstones();
    const next: Tombstones = {
      plans: { ...current.plans, [id]: Date.now() },
    };
    await AsyncStorage.setItem(
      STORAGE_KEYS.tombstones,
      JSON.stringify(next),
    );
  });
}

export { EMPTY as EMPTY_TOMBSTONES };
