import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultPlanPrefs } from '../constants/plans';
import type { PlanItem, PlanPrefs } from '../types';
import {
  isPlanItem,
  normalizePlanPrefs,
} from '../utils/planValidation';
import { STORAGE_KEYS } from './keys';

// Plans have their own queue so plan writes never interleave with sessions or
// the timer. Each mutation is a serialized read-modify-write.
let writeChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeChain.then(task, task);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readPlanItems(): Promise<PlanItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.plans);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Keep the last valid entry for duplicate ids.
    const byId = new Map<string, PlanItem>();
    parsed.forEach((item) => {
      if (isPlanItem(item)) byId.set(item.id, item);
    });
    return [...byId.values()];
  } catch (error) {
    console.warn('[tally] failed to read plans', error);
    return [];
  }
}

async function readPlanPrefs(): Promise<PlanPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.planPrefs);
    if (raw == null) return createDefaultPlanPrefs();
    const parsed: unknown = JSON.parse(raw);
    return normalizePlanPrefs(parsed);
  } catch (error) {
    console.warn('[tally] failed to read plan prefs', error);
    return createDefaultPlanPrefs();
  }
}

export interface LoadedPlans {
  items: PlanItem[];
  prefs: PlanPrefs;
}

export async function loadPlans(): Promise<LoadedPlans> {
  const [items, prefs] = await Promise.all([
    readPlanItems(),
    readPlanPrefs(),
  ]);
  return { items, prefs };
}

export function upsertPlanItem(item: PlanItem): Promise<PlanItem[]> {
  return enqueue(async () => {
    const items = await readPlanItems();
    const index = items.findIndex(
      (existing) => existing.id === item.id,
    );
    const next =
      index < 0
        ? [...items, item]
        : items.map((existing, itemIndex) =>
            itemIndex === index ? item : existing,
          );
    await AsyncStorage.setItem(STORAGE_KEYS.plans, JSON.stringify(next));
    return next;
  });
}

export function removePlanItem(id: string): Promise<PlanItem[]> {
  return enqueue(async () => {
    const items = await readPlanItems();
    const next = items.filter((item) => item.id !== id);
    if (next.length !== items.length) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.plans,
        JSON.stringify(next),
      );
    }
    return next;
  });
}

export function savePlanPrefs(prefs: PlanPrefs): Promise<void> {
  return enqueue(() =>
    AsyncStorage.setItem(
      STORAGE_KEYS.planPrefs,
      JSON.stringify(prefs),
    ),
  );
}
