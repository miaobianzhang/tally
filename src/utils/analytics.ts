import { FALLBACK_CATEGORY } from '../constants/categories';
import type {
  CategoryDefinition,
  CategoryId,
  CategoryLookup,
  Session,
} from '../types';
import {
  calendarDayCount,
  type Bucket,
  type DateRange,
} from './dateRange';
import { allocateShares } from './time';

export interface ActivityGroup {
  key: string;
  label: string;
  category: CategoryId;
  color: string;
  ms: number;
  percentage: number;
}

export interface CategoryGroup {
  id: CategoryId;
  label: string;
  color: string;
  ms: number;
  percentage: number;
  activities: ActivityGroup[];
}

export interface Breakdown {
  totalMs: number;
  /** Time in categories marked countsAsFocus, clipped to the same range. */
  studyWorkMs: number;
  categories: CategoryGroup[];
  /** Flattened in category order; used by the donut's outer ring. */
  activities: ActivityGroup[];
}

export interface TrendBucket extends Bucket {
  totalMs: number;
  /** Keyed by category id; missing ids are zero. */
  categoryMs: Record<string, number>;
  studyWorkMs: number;
}

export interface TrendAnalysis {
  buckets: TrendBucket[];
  totalMs: number;
  studyWorkMs: number;
  days: number;
  dailyAverageMs: number;
}

export function focusLabel(lookup: CategoryLookup): string {
  const focus = lookup.ordered.filter((category) => category.countsAsFocus);
  if (
    focus.length === 2 &&
    focus.every(
      (category) =>
        category.id === 'work' || category.id === 'study',
    )
  ) {
    return '学习 + 工作';
  }
  if (focus.length > 0 && focus.length <= 2) {
    return focus.map((category) => category.label).join(' + ');
  }
  return '专注时间';
}

export function overlapMs(
  session: Session,
  start: number,
  end: number,
): number {
  return Math.max(
    0,
    Math.min(session.endedAt, end) - Math.max(session.startedAt, start),
  );
}

export function normalizeActivityLabel(activity: string): string {
  return activity.trim().replace(/\s+/g, ' ');
}

interface ActivityAccumulator {
  key: string;
  label: string;
  category: CategoryId;
  ms: number;
  firstSeen: number;
}

function fallbackCategory(id: CategoryId): CategoryDefinition {
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

export function buildBreakdown(
  sessions: Session[],
  range: DateRange,
  lookup: CategoryLookup,
): Breakdown {
  if (range.end <= range.start) {
    return {
      totalMs: 0,
      studyWorkMs: 0,
      categories: [],
      activities: [],
    };
  }

  const activitiesByCategory = new Map<
    CategoryId,
    Map<string, ActivityAccumulator>
  >();
  const unknownIds = new Map<CategoryId, number>();
  let totalMs = 0;
  let studyWorkMs = 0;

  sessions.forEach((session, sessionIndex) => {
    const activityMs = overlapMs(session, range.start, range.end);
    if (activityMs <= 0) return;

    const label = normalizeActivityLabel(session.activity);
    if (!label) return;

    if (!lookup.byId.has(session.category) && !unknownIds.has(session.category)) {
      unknownIds.set(session.category, unknownIds.size);
    }

    const key = `${session.category}|${label.toLowerCase()}`;
    let categoryActivities = activitiesByCategory.get(session.category);
    if (!categoryActivities) {
      categoryActivities = new Map<string, ActivityAccumulator>();
      activitiesByCategory.set(session.category, categoryActivities);
    }

    const existing = categoryActivities.get(key);
    if (existing) {
      existing.ms += activityMs;
    } else {
      categoryActivities.set(key, {
        key,
        label,
        category: session.category,
        ms: activityMs,
        firstSeen: sessionIndex,
      });
    }

    totalMs += activityMs;
    if (lookup.focusIds.has(session.category)) {
      studyWorkMs += activityMs;
    }
  });

  const orderedCategories = [...lookup.ordered];
  const unknown = [...unknownIds.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => fallbackCategory(id));
  const categoriesWithData = [...orderedCategories, ...unknown]
    .map((category) => {
      const accumulatorMap = activitiesByCategory.get(category.id);
      const activities = accumulatorMap
        ? [...accumulatorMap.values()].sort(
            (a, b) => b.ms - a.ms || a.firstSeen - b.firstSeen,
          )
        : [];
      const ms = activities.reduce((sum, activity) => sum + activity.ms, 0);
      return { category, activities, ms };
    })
    .filter((row) => row.ms > 0);

  const categoryShares = allocateShares(
    categoriesWithData.map((row) => row.ms),
    100,
  );

  const categories: CategoryGroup[] = categoriesWithData.map(
    ({ category, activities, ms }, index) => {
      const percentage = categoryShares[index];
      const activityShares = allocateShares(
        activities.map((activity) => activity.ms),
        percentage,
      );

      return {
        id: category.id,
        label: category.label,
        color: category.color,
        ms,
        percentage,
        activities: activities.map((activity, activityIndex) => ({
          key: activity.key,
          label: activity.label,
          category: activity.category,
          color: category.color,
          ms: activity.ms,
          percentage: activityShares[activityIndex],
        })),
      };
    },
  );

  return {
    totalMs,
    studyWorkMs,
    categories,
    activities: categories.flatMap((category) => category.activities),
  };
}

/** First bucket whose end is after `timestamp`. */
function findFirstBucket(buckets: Bucket[], timestamp: number): number {
  let low = 0;
  let high = buckets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (buckets[middle].end <= timestamp) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

export function buildTrendAnalysis(
  sessions: Session[],
  range: DateRange,
  buckets: Bucket[],
  lookup: CategoryLookup,
): TrendAnalysis {
  const trendBuckets: TrendBucket[] = buckets.map((bucket) => ({
    ...bucket,
    totalMs: 0,
    categoryMs: {},
    studyWorkMs: 0,
  }));

  let totalMs = 0;
  let studyWorkMs = 0;

  sessions.forEach((session) => {
    if (session.endedAt <= range.start || session.startedAt >= range.end) {
      return;
    }
    const start = Math.max(session.startedAt, range.start);
    const end = Math.min(session.endedAt, range.end);
    let index = findFirstBucket(buckets, start);

    while (index < buckets.length) {
      const bucket = buckets[index];
      if (bucket.start >= end) break;
      const activityMs = overlapMs(session, bucket.start, bucket.end);
      if (activityMs > 0) {
        const target = trendBuckets[index];
        target.totalMs += activityMs;
        target.categoryMs[session.category] =
          (target.categoryMs[session.category] ?? 0) + activityMs;
        if (lookup.focusIds.has(session.category)) {
          target.studyWorkMs += activityMs;
        }
        totalMs += activityMs;
        if (lookup.focusIds.has(session.category)) {
          studyWorkMs += activityMs;
        }
      }
      index += 1;
    }
  });

  const days = calendarDayCount(range);

  return {
    buckets: trendBuckets,
    totalMs,
    studyWorkMs,
    days,
    dailyAverageMs: days > 0 ? totalMs / days : 0,
  };
}
