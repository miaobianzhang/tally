import { PLAN_SECTIONS } from '../types';
import type { PlanPrefs, PlanSection } from '../types';

export const PLAN_SECTION_LABELS: Record<PlanSection, string> = {
  week: '周计划',
  month: '月计划',
  deadline: 'Deadline',
};

export const SECTION_VISIBILITY_KEYS: Record<
  PlanSection,
  'showWeek' | 'showMonth' | 'showDeadlines'
> = {
  week: 'showWeek',
  month: 'showMonth',
  deadline: 'showDeadlines',
};

export const DEFAULT_PLAN_PREFS: PlanPrefs = {
  showWeek: true,
  showMonth: true,
  showDeadlines: true,
  sectionOrder: [...PLAN_SECTIONS],
};

export function createDefaultPlanPrefs(): PlanPrefs {
  return {
    ...DEFAULT_PLAN_PREFS,
    sectionOrder: [...DEFAULT_PLAN_PREFS.sectionOrder],
  };
}

export const PLAN_FUTURE_PERIODS = {
  week: 52,
  month: 24,
} as const;

export const PLAN_DEADLINE_YEARS = 5;
