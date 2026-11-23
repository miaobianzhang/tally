import type {
  CategoryDefinition,
  PlanItem,
  PlanPrefs,
  Prefs,
  Session,
  Tombstones,
} from '../types';
import { isCategoryId, isPlanSection } from '../types';

export interface TallySnapshot {
  schemaVersion: 2;
  exportedAt: number;
  categories: CategoryDefinition[];
  sessions: Session[];
  plans: PlanItem[];
  prefs: Prefs;
  planPrefs: PlanPrefs;
  tombstones: Tombstones;
}

export const EMPTY_TOMBSTONES: Tombstones = { plans: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCategory(value: unknown): value is CategoryDefinition {
  if (!isRecord(value)) return false;
  return (
    isCategoryId(value.id) &&
    typeof value.label === 'string' &&
    value.label.length > 0 &&
    typeof value.color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(value.color) &&
    typeof value.archived === 'boolean' &&
    (value.deleted === undefined || typeof value.deleted === 'boolean') &&
    typeof value.countsAsFocus === 'boolean' &&
    isNumber(value.order) &&
    isNumber(value.createdAt) &&
    isNumber(value.updatedAt)
  );
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.activity === 'string' &&
    isCategoryId(value.category) &&
    isNumber(value.startedAt) &&
    isNumber(value.endedAt) &&
    isNumber(value.createdAt) &&
    (value.updatedAt === undefined || isNumber(value.updatedAt))
  );
}

function isPlan(value: unknown): value is PlanItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    isPlanSection(value.section) &&
    typeof value.title === 'string' &&
    isCategoryId(value.category) &&
    (value.periodStart === null || isNumber(value.periodStart)) &&
    (value.dueAt === null || isNumber(value.dueAt)) &&
    (value.completedAt === null || isNumber(value.completedAt)) &&
    isNumber(value.createdAt) &&
    isNumber(value.updatedAt)
  );
}

function isPrefs(value: unknown): value is Prefs {
  return (
    isRecord(value) &&
    isCategoryId(value.lastCategory) &&
    (value.updatedAt === undefined || isNumber(value.updatedAt))
  );
}

function isPlanPrefs(value: unknown): value is PlanPrefs {
  return (
    isRecord(value) &&
    typeof value.showWeek === 'boolean' &&
    typeof value.showMonth === 'boolean' &&
    typeof value.showDeadlines === 'boolean' &&
    Array.isArray(value.sectionOrder) &&
    value.sectionOrder.every(isPlanSection) &&
    (value.updatedAt === undefined || isNumber(value.updatedAt))
  );
}

function isTombstones(value: unknown): value is Tombstones {
  return (
    isRecord(value) &&
    isRecord(value.plans) &&
    Object.values(value.plans).every(isNumber)
  );
}

export function isTallySnapshot(value: unknown): value is TallySnapshot {
  if (!isRecord(value) || value.schemaVersion !== 2) return false;
  return (
    isNumber(value.exportedAt) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategory) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(isSession) &&
    Array.isArray(value.plans) &&
    value.plans.every(isPlan) &&
    isPrefs(value.prefs) &&
    isPlanPrefs(value.planPrefs) &&
    isTombstones(value.tombstones)
  );
}

export function buildSnapshot(input: {
  categories: CategoryDefinition[];
  sessions: Session[];
  plans: PlanItem[];
  prefs: Prefs;
  planPrefs: PlanPrefs;
  tombstones?: Tombstones;
}): TallySnapshot {
  return {
    schemaVersion: 2,
    exportedAt: Date.now(),
    categories: input.categories,
    sessions: input.sessions,
    plans: input.plans,
    prefs: input.prefs,
    planPrefs: input.planPrefs,
    tombstones: input.tombstones ?? EMPTY_TOMBSTONES,
  };
}
