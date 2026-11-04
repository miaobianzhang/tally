import type { PlanItem, PlanSection } from '../types';
import {
  addDays,
  formatFullDateWithYear,
  formatMonthTitle,
  formatRangeLabel,
} from './dateRange';
import { normalizeSectionOrder } from './planValidation';
import { dayStart } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DeadlineTone =
  | 'overdue'
  | 'today'
  | 'upcoming'
  | 'completed';

export interface PlanProgress {
  total: number;
  completed: number;
  percent: number;
}

export function normalizePlanTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

export function plansForPeriod(
  items: readonly PlanItem[],
  section: PlanSection,
  periodStart: number,
): PlanItem[] {
  return items.filter(
    (item) =>
      item.section === section && item.periodStart === periodStart,
  );
}

export function sortPlansForSection(
  items: readonly PlanItem[],
  section: PlanSection,
): PlanItem[] {
  return [...items].sort((a, b) => {
    const aDone = a.completedAt !== null;
    const bDone = b.completedAt !== null;
    if (aDone !== bDone) return aDone ? 1 : -1;

    if (section === 'deadline') {
      const aDue = a.dueAt ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
    }

    return (
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id)
    );
  });
}

export function movePlanSection(
  order: readonly PlanSection[],
  section: PlanSection,
  targetIndex: number,
): PlanSection[] {
  const normalized = normalizeSectionOrder(order);
  const currentIndex = normalized.indexOf(section);
  if (currentIndex < 0) return normalized;

  const requested = Number.isFinite(targetIndex)
    ? Math.trunc(targetIndex)
    : currentIndex;
  const clamped = Math.max(
    0,
    Math.min(normalized.length - 1, requested),
  );
  if (clamped === currentIndex) return normalized;

  const next = [...normalized];
  next.splice(currentIndex, 1);
  next.splice(clamped, 0, section);
  return next;
}

export function planProgress(items: readonly PlanItem[]): PlanProgress {
  const total = items.length;
  const completed = items.filter(
    (item) => item.completedAt !== null,
  ).length;
  const percent =
    total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

export function planPeriodLabel(
  section: PlanSection,
  start: number | null,
): string {
  if (section === 'deadline' || start === null) return '';
  if (section === 'month') return formatMonthTitle(start);
  return formatRangeLabel({ start, end: addDays(start, 7) });
}

function dayIndex(timestamp: number): number {
  const date = new Date(timestamp);
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    DAY_MS
  );
}

/** Whole calendar days from `from` to `to`; positive means `to` is later. */
export function calendarDayDifference(
  from: number,
  to: number,
): number {
  return Math.round(dayIndex(to) - dayIndex(from));
}

export function deadlineTone(
  plan: PlanItem,
  now = Date.now(),
): DeadlineTone {
  if (plan.completedAt !== null) return 'completed';
  if (plan.dueAt === null) return 'upcoming';

  const diff = calendarDayDifference(dayStart(now), plan.dueAt);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

export function deadlineLabel(
  plan: PlanItem,
  now = Date.now(),
): string {
  if (plan.dueAt === null) return '';
  if (plan.completedAt !== null) return '已完成';

  const diff = calendarDayDifference(dayStart(now), plan.dueAt);
  if (diff === 0) return '今天截止';
  if (diff === 1) return '明天截止';
  if (diff < 0) return `已逾期 ${Math.abs(diff)} 天`;
  if (diff <= 7) return `${diff} 天后`;
  return formatFullDateWithYear(plan.dueAt);
}
