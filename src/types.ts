export const BUILTIN_CATEGORY_IDS = [
  'work',
  'study',
  'rest',
  'exercise',
  'life',
  'other',
] as const;

export type BuiltinCategoryId = (typeof BUILTIN_CATEGORY_IDS)[number];

/**
 * Category ids are persisted data. Keep this open-ended so ids created by this
 * version, restored backups, or a newer app version are never dropped.
 */
export type CategoryId = string;

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  color: string;
  archived: boolean;
  countsAsFocus: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryState {
  version: 1;
  categories: CategoryDefinition[];
}

export interface Session {
  id: string;
  activity: string;
  category: CategoryId;
  startedAt: number;
  endedAt: number;
  createdAt: number;
  /** Last edit time; legacy records fall back to createdAt. */
  updatedAt?: number;
}

/** Snapshot of a plan item taken when its timer starts. */
export interface TimerPrefill {
  planId: string;
  activity: string;
  category: CategoryId;
}

export type TimerState =
  | { status: 'idle' }
  | {
      status: 'running';
      id: string;
      startedAt: number;
      prefill?: TimerPrefill;
    }
  | {
      status: 'pending';
      id: string;
      startedAt: number;
      endedAt: number;
      prefill?: TimerPrefill;
    };

export interface Prefs {
  lastCategory: CategoryId;
  updatedAt?: number;
}

export const PLAN_SECTIONS = ['week', 'month', 'deadline'] as const;

export type PlanSection = (typeof PLAN_SECTIONS)[number];

export interface PlanItem {
  id: string;
  section: PlanSection;
  title: string;
  category: CategoryId;
  /** Monday 00:00 for weekly plans, first-of-month 00:00 for monthly plans. */
  periodStart: number | null;
  /** Local day start for deadlines. */
  dueAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlanPrefs {
  showWeek: boolean;
  showMonth: boolean;
  showDeadlines: boolean;
  sectionOrder: PlanSection[];
  updatedAt?: number;
}

export interface Tombstones {
  plans: Record<string, number>;
}

export interface Profile {
  displayName: string;
  avatarUri: string | null;
  updatedAt: number;
}

export interface CategoryLookup {
  byId: ReadonlyMap<CategoryId, CategoryDefinition>;
  active: readonly CategoryDefinition[];
  ordered: readonly CategoryDefinition[];
  focusIds: ReadonlySet<CategoryId>;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !/[\u0000-\u001f]/.test(value)
  );
}

export function isBuiltinCategoryId(
  value: unknown,
): value is BuiltinCategoryId {
  return (
    typeof value === 'string' &&
    (BUILTIN_CATEGORY_IDS as readonly string[]).includes(value)
  );
}

export function isPlanSection(value: unknown): value is PlanSection {
  return (
    typeof value === 'string' &&
    (PLAN_SECTIONS as readonly string[]).includes(value)
  );
}
