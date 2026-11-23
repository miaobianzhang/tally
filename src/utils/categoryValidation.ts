import {
  BUILTIN_CATEGORIES,
  FALLBACK_CATEGORY,
  createSeedCategories,
} from '../constants/categories';
import type { CategoryDefinition, CategoryId, CategoryState } from '../types';
import { isCategoryId } from '../types';
import { createId } from './id';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

export function normalizeColor(value: unknown, fallback: string): string {
  return isHexColor(value) ? value.toUpperCase() : fallback;
}

export function normalizeCategoryLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, 16);
}

export function createCustomCategoryId(): CategoryId {
  return `custom-${createId()}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isCategoryDefinition(
  value: unknown,
): value is CategoryDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isCategoryId(record.id) &&
    typeof record.label === 'string' &&
    record.label.length > 0 &&
    isHexColor(record.color) &&
    typeof record.archived === 'boolean' &&
    (record.deleted === undefined || typeof record.deleted === 'boolean') &&
    typeof record.countsAsFocus === 'boolean' &&
    isFiniteNumber(record.order) &&
    isFiniteNumber(record.createdAt) &&
    isFiniteNumber(record.updatedAt)
  );
}

/**
 * Normalizes persisted categories. Missing storage falls back to the built-in
 * six; damaged rows are dropped; built-ins are restored if they vanished.
 * `referencedIds` lets the caller heal records that point at a category the
 * catalog no longer knows about.
 */
export function normalizeCategoryState(
  value: unknown,
  referencedIds: readonly CategoryId[] = [],
): CategoryDefinition[] {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as CategoryState).categories)
      ? (value as CategoryState).categories
      : null;

  if (!rawList) return createSeedCategories();

  const byId = new Map<CategoryId, CategoryDefinition>();
  rawList.forEach((item) => {
    if (!isCategoryDefinition(item)) return;
    const label = normalizeCategoryLabel(item.label);
    if (!label) return;
    const deleted = item.deleted === true;
    byId.set(item.id, {
      ...item,
      label,
      color: normalizeColor(item.color, FALLBACK_CATEGORY.color),
      archived: deleted ? true : item.archived,
      deleted: deleted || undefined,
    });
  });

  BUILTIN_CATEGORIES.forEach((seed) => {
    if (!byId.has(seed.id)) byId.set(seed.id, { ...seed });
  });

  referencedIds.forEach((id) => {
    if (byId.has(id)) return;
    byId.set(id, {
      id,
      label: FALLBACK_CATEGORY.label,
      color: FALLBACK_CATEGORY.color,
      archived: true,
      countsAsFocus: false,
      order: Number.MAX_SAFE_INTEGER,
      createdAt: 0,
      updatedAt: 0,
    });
  });

  const categories = [...byId.values()].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt,
  );

  // Orders must be unique so merging and rendering stay deterministic.
  categories.forEach((category, index) => {
    category.order = index;
  });

  if (categories.length === 0) return createSeedCategories();

  const visible = categories.filter((category) => !category.deleted);
  const active = visible.filter((category) => !category.archived);
  if (active.length === 0) {
    const first = visible[0] ?? categories[0];
    first.archived = false;
    first.deleted = undefined;
    first.updatedAt = Date.now();
  }

  return categories;
}

export function normalizeReferencedCategoryIds(
  sessions: readonly { category: CategoryId }[],
  plans: readonly { category: CategoryId }[],
): CategoryId[] {
  const ids = new Set<CategoryId>();
  sessions.forEach((session) => ids.add(session.category));
  plans.forEach((plan) => ids.add(plan.category));
  return [...ids];
}
