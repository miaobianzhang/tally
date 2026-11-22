import type {
  CategoryDefinition,
  PlanItem,
  PlanPrefs,
  Prefs,
  Session,
  Tombstones,
} from '../types';
import type { TallySnapshot } from '../utils/snapshot';

function sessionTime(session: Session): number {
  return session.updatedAt ?? session.createdAt;
}

function pickNewer<T extends { updatedAt?: number }>(
  local: T,
  remote: T,
): T {
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
}

function mergeById<T>(
  local: readonly T[],
  remote: readonly T[],
  getId: (item: T) => string,
  getTime: (item: T) => number,
): T[] {
  const byId = new Map<string, T>();
  local.forEach((item) => byId.set(getId(item), item));
  remote.forEach((item) => {
    const existing = byId.get(getId(item));
    if (!existing || getTime(item) >= getTime(existing)) {
      byId.set(getId(item), item);
    }
  });
  return [...byId.values()];
}

function mergePlans(
  local: readonly PlanItem[],
  remote: readonly PlanItem[],
  tombstones: Tombstones,
): PlanItem[] {
  const merged = mergeById(
    local,
    remote,
    (plan) => plan.id,
    (plan) => plan.updatedAt,
  );
  return merged.filter((plan) => {
    const deletedAt = tombstones.plans[plan.id];
    return deletedAt === undefined || deletedAt <= plan.updatedAt;
  });
}

function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const plans: Record<string, number> = { ...a.plans };
  Object.entries(b.plans).forEach(([id, deletedAt]) => {
    plans[id] = Math.max(plans[id] ?? 0, deletedAt);
  });
  return { plans };
}

function mergeCategories(
  local: readonly CategoryDefinition[],
  remote: readonly CategoryDefinition[],
): CategoryDefinition[] {
  const byId = new Map<string, CategoryDefinition>();
  local.forEach((category) => byId.set(category.id, category));
  remote.forEach((category) => {
    const existing = byId.get(category.id);
    if (!existing || category.updatedAt > existing.updatedAt) {
      byId.set(category.id, category);
    }
  });
  const categories = [...byId.values()].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt,
  );
  categories.forEach((category, index) => {
    category.order = index;
  });
  if (!categories.some((category) => !category.archived) && categories[0]) {
    categories[0].archived = false;
  }
  return categories;
}

export interface MergeResult {
  snapshot: TallySnapshot;
  stats: {
    sessions: number;
    plans: number;
    categories: number;
  };
}

export function mergeSnapshots(
  local: TallySnapshot,
  remote: TallySnapshot,
): MergeResult {
  const tombstones = mergeTombstones(
    local.tombstones,
    remote.tombstones,
  );
  const sessions = mergeById(
    local.sessions,
    remote.sessions,
    (session) => session.id,
    sessionTime,
  );
  const plans = mergePlans(local.plans, remote.plans, tombstones);
  const categories = mergeCategories(
    local.categories,
    remote.categories,
  );
  const prefs: Prefs = pickNewer(local.prefs, remote.prefs);
  const planPrefs: PlanPrefs = pickNewer(
    local.planPrefs,
    remote.planPrefs,
  );

  return {
    snapshot: {
      schemaVersion: 2,
      exportedAt: Date.now(),
      categories,
      sessions,
      plans,
      prefs,
      planPrefs,
      tombstones,
    },
    stats: {
      sessions: sessions.length,
      plans: plans.length,
      categories: categories.length,
    },
  };
}

export function snapshotsEqual(
  a: TallySnapshot,
  b: TallySnapshot,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
