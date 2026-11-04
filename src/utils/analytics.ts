import { CATEGORIES } from '../constants/categories';
import type { CategoryId, Session } from '../types';
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
  /** Work + study, already clipped to the same range as totalMs. */
  studyWorkMs: number;
  categories: CategoryGroup[];
  /** Flattened in category order; used by the donut's outer ring. */
  activities: ActivityGroup[];
}

export interface TrendBucket extends Bucket {
  totalMs: number;
  /** Aligned with CATEGORIES. */
  categoryMs: number[];
  studyWorkMs: number;
}

export interface TrendAnalysis {
  buckets: TrendBucket[];
  totalMs: number;
  studyWorkMs: number;
  days: number;
  dailyAverageMs: number;
}

const STUDY_WORK_IDS: readonly CategoryId[] = ['work', 'study'];
const CATEGORY_INDEX = new Map<CategoryId, number>(
  CATEGORIES.map((category, index) => [category.id, index]),
);

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

export function buildBreakdown(
  sessions: Session[],
  range: DateRange,
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
  let totalMs = 0;
  let studyWorkMs = 0;

  sessions.forEach((session, sessionIndex) => {
    const activityMs = overlapMs(session, range.start, range.end);
    if (activityMs <= 0) return;

    const label = normalizeActivityLabel(session.activity);
    if (!label) return;

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
    if (STUDY_WORK_IDS.includes(session.category)) {
      studyWorkMs += activityMs;
    }
  });

  const categoriesWithData = CATEGORIES.map((category) => {
    const accumulatorMap = activitiesByCategory.get(category.id);
    const activities = accumulatorMap
      ? [...accumulatorMap.values()].sort(
          (a, b) => b.ms - a.ms || a.firstSeen - b.firstSeen,
        )
      : [];
    const ms = activities.reduce((sum, activity) => sum + activity.ms, 0);
    return { category, activities, ms };
  }).filter((row) => row.ms > 0);

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

export function buildTrendAnalysis(
  sessions: Session[],
  range: DateRange,
  buckets: Bucket[],
): TrendAnalysis {
  const trendBuckets: TrendBucket[] = buckets.map((bucket) => ({
    ...bucket,
    totalMs: 0,
    categoryMs: CATEGORIES.map(() => 0),
    studyWorkMs: 0,
  }));

  let totalMs = 0;
  let studyWorkMs = 0;

  sessions.forEach((session) => {
    trendBuckets.forEach((bucket) => {
      const activityMs = overlapMs(session, bucket.start, bucket.end);
      if (activityMs <= 0) return;

      bucket.totalMs += activityMs;
      const categoryIndex = CATEGORY_INDEX.get(session.category);
      if (categoryIndex !== undefined) {
        bucket.categoryMs[categoryIndex] += activityMs;
      }
      if (STUDY_WORK_IDS.includes(session.category)) {
        bucket.studyWorkMs += activityMs;
      }

      totalMs += activityMs;
      if (STUDY_WORK_IDS.includes(session.category)) {
        studyWorkMs += activityMs;
      }
    });
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
