import type {
  CategoryDefinition,
  CategoryId,
  CategoryLookup,
} from '../types';

// Fixed seed order and colors: a category keeps its color when its rank
// changes. Users can edit these later; this is only the first-run catalog.
export const BUILTIN_CATEGORIES: readonly CategoryDefinition[] = [
  { id: 'work', label: '工作', color: '#2a78d6', archived: false, countsAsFocus: true, order: 0, createdAt: 0, updatedAt: 0 },
  { id: 'study', label: '学习', color: '#eb6834', archived: false, countsAsFocus: true, order: 1, createdAt: 0, updatedAt: 0 },
  { id: 'rest', label: '休息', color: '#1baf7a', archived: false, countsAsFocus: false, order: 2, createdAt: 0, updatedAt: 0 },
  { id: 'exercise', label: '运动', color: '#eda100', archived: false, countsAsFocus: false, order: 3, createdAt: 0, updatedAt: 0 },
  { id: 'life', label: '生活', color: '#e87ba4', archived: false, countsAsFocus: false, order: 4, createdAt: 0, updatedAt: 0 },
  { id: 'other', label: '其他', color: '#008300', archived: false, countsAsFocus: false, order: 5, createdAt: 0, updatedAt: 0 },
];

export const DEFAULT_CATEGORY_ID: CategoryId = 'other';

export const FALLBACK_CATEGORY = {
  label: '未分类',
  color: '#8a8a86',
} as const;

export const CATEGORY_COLOR_PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#7c5cff',
  '#d03b3b',
  '#0f9b9b',
  '#8a5a2b',
  '#5f6b7a',
  '#b34d8d',
] as const;

export function createSeedCategories(): CategoryDefinition[] {
  return BUILTIN_CATEGORIES.map((category) => ({ ...category }));
}

export function createCategoryLookup(
  categories: readonly CategoryDefinition[],
): CategoryLookup {
  const ordered = [...categories].sort((a, b) => a.order - b.order);
  const byId = new Map(ordered.map((category) => [category.id, category]));
  const active = ordered.filter((category) => !category.archived);
  const focusIds = new Set(
    ordered
      .filter((category) => category.countsAsFocus)
      .map((category) => category.id),
  );

  return { byId, active, ordered, focusIds };
}

export function resolveCategory(
  categories: readonly CategoryDefinition[],
  id: CategoryId,
): CategoryDefinition {
  const found = categories.find((category) => category.id === id);
  if (found) return found;

  return {
    id,
    label: FALLBACK_CATEGORY.label,
    color: FALLBACK_CATEGORY.color,
    archived: true,
    countsAsFocus: false,
    order: Number.MAX_SAFE_INTEGER,
    createdAt: 0,
    updatedAt: 0,
  };
}
