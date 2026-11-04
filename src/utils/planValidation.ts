import { createDefaultPlanPrefs } from '../constants/plans';
import {
  PLAN_SECTIONS,
  isCategoryId,
  isPlanSection,
  type PlanItem,
  type PlanPrefs,
  type PlanSection,
} from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPlanItem(value: unknown): value is PlanItem {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    value.title.trim().length === 0 ||
    !isCategoryId(value.category) ||
    !isPlanSection(value.section) ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return false;
  }

  if (
    value.completedAt !== null &&
    !isFiniteNumber(value.completedAt)
  ) {
    return false;
  }

  if (value.section === 'deadline') {
    return value.periodStart === null && isFiniteNumber(value.dueAt);
  }

  return isFiniteNumber(value.periodStart) && value.dueAt === null;
}

export function normalizeSectionOrder(value: unknown): PlanSection[] {
  const order: PlanSection[] = [];

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isPlanSection(item) && !order.includes(item)) {
        order.push(item);
      }
    });
  }

  PLAN_SECTIONS.forEach((section) => {
    if (!order.includes(section)) {
      order.push(section);
    }
  });

  return order;
}

export function normalizePlanPrefs(value: unknown): PlanPrefs {
  if (
    !isRecord(value) ||
    typeof value.showWeek !== 'boolean' ||
    typeof value.showMonth !== 'boolean' ||
    typeof value.showDeadlines !== 'boolean'
  ) {
    return createDefaultPlanPrefs();
  }

  return {
    showWeek: value.showWeek,
    showMonth: value.showMonth,
    showDeadlines: value.showDeadlines,
    sectionOrder: normalizeSectionOrder(value.sectionOrder),
  };
}

export function isPlanPrefs(value: unknown): value is PlanPrefs {
  if (!isRecord(value)) return false;

  return (
    typeof value.showWeek === 'boolean' &&
    typeof value.showMonth === 'boolean' &&
    typeof value.showDeadlines === 'boolean' &&
    Array.isArray(value.sectionOrder) &&
    value.sectionOrder.length === PLAN_SECTIONS.length &&
    value.sectionOrder.every(isPlanSection) &&
    new Set(value.sectionOrder).size === PLAN_SECTIONS.length
  );
}
