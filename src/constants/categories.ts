import type { CategoryId } from '../types';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  color: string;
}

// Fixed order and fixed colors: colors follow the category, never its rank.
// Light palette from the dataviz reference (validated for adjacent pairs).
export const CATEGORIES: readonly CategoryMeta[] = [
  { id: 'work', label: '工作', color: '#2a78d6' },
  { id: 'study', label: '学习', color: '#eb6834' },
  { id: 'rest', label: '休息', color: '#1baf7a' },
  { id: 'exercise', label: '运动', color: '#eda100' },
  { id: 'life', label: '生活', color: '#e87ba4' },
  { id: 'other', label: '其他', color: '#008300' },
];

export const DEFAULT_CATEGORY: CategoryId = 'other';

const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category]),
) as Record<CategoryId, CategoryMeta>;

export function getCategory(id: CategoryId): CategoryMeta {
  return CATEGORY_BY_ID[id];
}
