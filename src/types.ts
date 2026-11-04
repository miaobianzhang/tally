export const CATEGORY_IDS = [
  'work',
  'study',
  'rest',
  'exercise',
  'life',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Session {
  id: string;
  activity: string;
  category: CategoryId;
  startedAt: number;
  endedAt: number;
  createdAt: number;
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
}

export function isCategoryId(value: unknown): value is CategoryId {
  return (
    typeof value === 'string' &&
    (CATEGORY_IDS as readonly string[]).includes(value)
  );
}

export function isPlanSection(value: unknown): value is PlanSection {
  return (
    typeof value === 'string' &&
    (PLAN_SECTIONS as readonly string[]).includes(value)
  );
}
