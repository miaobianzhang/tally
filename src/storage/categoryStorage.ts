import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CategoryDefinition, CategoryState } from '../types';
import { normalizeCategoryState } from '../utils/categoryValidation';
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

export async function loadCategories(): Promise<CategoryDefinition[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.categories);
    if (raw == null) return normalizeCategoryState(null);
    const parsed: unknown = JSON.parse(raw);
    return normalizeCategoryState(parsed);
  } catch (error) {
    console.warn('[tally] failed to read categories', error);
    return normalizeCategoryState(null);
  }
}

export function replaceCategories(
  categories: readonly CategoryDefinition[],
): Promise<CategoryDefinition[]> {
  return enqueue(async () => {
    const normalized = normalizeCategoryState([...categories]);
    const state: CategoryState = { version: 1, categories: normalized };
    await AsyncStorage.setItem(
      STORAGE_KEYS.categories,
      JSON.stringify(state),
    );
    return normalized;
  });
}
