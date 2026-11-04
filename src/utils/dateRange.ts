import { dayStart, nextDayStart } from './time';

export interface DateRange {
  /** Local day start, inclusive. */
  start: number;
  /** Local day start after the last included day, exclusive. */
  end: number;
}

export type Granularity = 'day' | 'week';

export type RangePresetId = 'week' | 'month';

export type RangeSelection =
  | { kind: 'preset'; preset: RangePresetId }
  | { kind: 'week'; weekStart: number }
  | { kind: 'month'; monthStart: number }
  | { kind: 'custom'; range: DateRange };

export interface Bucket {
  start: number;
  end: number;
  granularity: Granularity;
  label: string;
  fullLabel: string;
}

export const RANGE_PRESETS: readonly {
  id: RangePresetId;
  label: string;
}[] = [
  { id: 'week', label: '本周' },
  { id: 'month', label: '本月' },
];

/** Keep custom ranges bounded so bucket counts cannot grow without limit. */
export const MAX_CUSTOM_DAYS = 366 * 5;

const WEEKDAYS_SHORT = [
  '周日',
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(timestamp: number, amount: number): number {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount,
  ).getTime();
}

export function startOfWeekMonday(timestamp: number): number {
  const date = new Date(timestamp);
  const offset = (date.getDay() + 6) % 7;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - offset,
  ).getTime();
}

export function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export function shiftMonth(timestamp: number, delta: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + delta, 1).getTime();
}

export function todayRange(now = Date.now()): DateRange {
  return { start: dayStart(now), end: nextDayStart(now) };
}

/** Whole calendar days covered by an end-exclusive range. */
export function calendarDayCount(range: DateRange): number {
  if (range.end <= range.start) return 0;
  const start = new Date(range.start);
  const end = new Date(range.end);
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / DAY_MS));
}

export function minCustomDay(now = Date.now()): number {
  return addDays(dayStart(now), -(MAX_CUSTOM_DAYS - 1));
}

export function currentPeriodStart(
  kind: RangePresetId,
  now = Date.now(),
): number {
  const today = dayStart(now);
  return kind === 'week'
    ? startOfWeekMonday(today)
    : startOfMonth(today);
}

export function currentWeekSelection(): RangeSelection {
  return { kind: 'preset', preset: 'week' };
}

export function currentMonthSelection(): RangeSelection {
  return { kind: 'preset', preset: 'month' };
}

export function isCurrentWeekStart(
  timestamp: number,
  now = Date.now(),
): boolean {
  return startOfWeekMonday(timestamp) === currentPeriodStart('week', now);
}

export function isCurrentMonthStart(
  timestamp: number,
  now = Date.now(),
): boolean {
  return startOfMonth(timestamp) === currentPeriodStart('month', now);
}

export function selectionPeriodKind(
  selection: RangeSelection,
): RangePresetId | null {
  if (selection.kind === 'custom') return null;
  if (selection.kind === 'preset') return selection.preset;
  return selection.kind;
}

/** Normalized Monday or first-of-month for a period selection. */
export function periodStartFor(
  selection: RangeSelection,
  now = Date.now(),
): number | null {
  const kind = selectionPeriodKind(selection);
  if (!kind) return null;

  if (selection.kind === 'preset') {
    return currentPeriodStart(kind, now);
  }

  if (selection.kind === 'week') {
    return startOfWeekMonday(selection.weekStart);
  }
  if (selection.kind === 'month') {
    return startOfMonth(selection.monthStart);
  }
  return null;
}

export function isCurrentPeriodSelection(
  selection: RangeSelection,
  now = Date.now(),
): boolean {
  const kind = selectionPeriodKind(selection);
  const start = periodStartFor(selection, now);
  return (
    kind !== null &&
    start !== null &&
    start === currentPeriodStart(kind, now)
  );
}

/** Full Monday–Sunday or calendar month used by the period switcher. */
export function periodDisplayRange(
  selection: RangeSelection,
  now = Date.now(),
): DateRange | null {
  const kind = selectionPeriodKind(selection);
  const start = periodStartFor(selection, now);
  if (!kind || start === null) return null;

  return {
    start,
    end: kind === 'week' ? addDays(start, 7) : shiftMonth(start, 1),
  };
}

/**
 * Move one period backward or forward. Returns null when the destination is
 * outside the five-year floor or in the future.
 */
export function shiftPeriodSelection(
  selection: RangeSelection,
  delta: number,
  now = Date.now(),
): RangeSelection | null {
  const kind = selectionPeriodKind(selection);
  const start = periodStartFor(selection, now);
  if (!kind || start === null) return null;

  const current = currentPeriodStart(kind, now);
  const floor = minCustomDay(now);
  const earliest =
    kind === 'week' ? startOfWeekMonday(floor) : startOfMonth(floor);
  const next =
    kind === 'week' ? addDays(start, 7 * delta) : shiftMonth(start, delta);

  if (next < earliest || next > current) return null;

  if (next === current) {
    return { kind: 'preset', preset: kind };
  }

  return kind === 'week'
    ? { kind: 'week', weekStart: next }
    : { kind: 'month', monthStart: next };
}

/**
 * Period navigation for plans. Unlike analysis, plans may sit in future
 * periods. Passing zero future periods reproduces analysis behavior.
 */
export function shiftPlanningSelection(
  selection: RangeSelection,
  delta: number,
  now = Date.now(),
  futurePeriods = 0,
): RangeSelection | null {
  const kind = selectionPeriodKind(selection);
  const start = periodStartFor(selection, now);
  if (!kind || start === null) return null;

  const current = currentPeriodStart(kind, now);
  const floor = minCustomDay(now);
  const earliest =
    kind === 'week' ? startOfWeekMonday(floor) : startOfMonth(floor);
  const future = Math.max(0, Math.floor(futurePeriods));
  const latest =
    kind === 'week'
      ? addDays(current, future * 7)
      : shiftMonth(current, future);
  const next =
    kind === 'week' ? addDays(start, 7 * delta) : shiftMonth(start, delta);

  if (next < earliest || next > latest) return null;

  if (next === current) {
    return { kind: 'preset', preset: kind };
  }

  return kind === 'week'
    ? { kind: 'week', weekStart: next }
    : { kind: 'month', monthStart: next };
}

export function resolveSelection(
  selection: RangeSelection,
  now = Date.now(),
): DateRange {
  const today = dayStart(now);
  const latestEnd = nextDayStart(today);

  if (selection.kind === 'preset') {
    return {
      start: currentPeriodStart(selection.preset, now),
      end: latestEnd,
    };
  }

  if (selection.kind === 'week') {
    const current = currentPeriodStart('week', now);
    const floor = startOfWeekMonday(minCustomDay(now));
    const normalized = startOfWeekMonday(selection.weekStart);

    if (normalized < floor || normalized > current) {
      return { start: current, end: latestEnd };
    }
    if (normalized === current) {
      return { start: current, end: latestEnd };
    }
    return { start: normalized, end: addDays(normalized, 7) };
  }

  if (selection.kind === 'month') {
    const current = currentPeriodStart('month', now);
    const floor = startOfMonth(minCustomDay(now));
    const normalized = startOfMonth(selection.monthStart);

    if (normalized < floor || normalized > current) {
      return { start: current, end: latestEnd };
    }
    if (normalized === current) {
      return { start: current, end: latestEnd };
    }
    return { start: normalized, end: shiftMonth(normalized, 1) };
  }

  const earliestStart = minCustomDay(now);
  const start = Math.max(dayStart(selection.range.start), earliestStart);
  const end = Math.min(selection.range.end, latestEnd);

  if (end <= start) {
    return {
      start: currentPeriodStart('week', now),
      end: latestEnd,
    };
  }
  return { start, end };
}

/** Weeks that intersect a calendar month, Monday through Sunday. */
export function buildWeeksForMonth(
  year: number,
  month: number,
): DateRange[] {
  const lastDay = new Date(year, month + 1, 0).getTime();
  const weeks: DateRange[] = [];
  let cursor = startOfWeekMonday(new Date(year, month, 1).getTime());

  while (cursor <= lastDay && weeks.length < 6) {
    weeks.push({ start: cursor, end: addDays(cursor, 7) });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function eachDay(range: DateRange): number[] {
  const days: number[] = [];
  let cursor = range.start;
  let guard = 0;

  while (cursor < range.end && guard < 10000) {
    days.push(cursor);
    const next = nextDayStart(cursor);
    if (next <= cursor) break;
    cursor = next;
    guard += 1;
  }
  return days;
}

export function buildBuckets(range: DateRange): Bucket[] {
  const days = eachDay(range);
  if (days.length === 0) return [];

  if (days.length <= 14) {
    return days.map((day) => ({
      start: day,
      end: nextDayStart(day),
      granularity: 'day' as const,
      label: days.length <= 7 ? formatWeekdayShort(day) : formatMonthDay(day),
      fullLabel: formatFullDateWithYear(day),
    }));
  }

  const buckets: Bucket[] = [];
  let cursor = range.start;
  let guard = 0;

  while (cursor < range.end && guard < 10000) {
    const weekStart = startOfWeekMonday(cursor);
    const weekEnd = Math.min(addDays(weekStart, 7), range.end);
    if (weekEnd <= cursor) break;

    buckets.push({
      start: cursor,
      end: weekEnd,
      granularity: 'week',
      label: formatMonthDay(cursor),
      fullLabel: formatRangeLabelWithYear({
        start: cursor,
        end: weekEnd,
      }),
    });
    cursor = weekEnd;
    guard += 1;
  }

  return buckets;
}

export function formatWeekdayShort(timestamp: number): string {
  return WEEKDAYS_SHORT[new Date(timestamp).getDay()];
}

export function formatMonthDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatWeekdayShort(timestamp)}`;
}

export function formatFullDateWithYear(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${formatWeekdayShort(timestamp)}`;
}

export function formatMonthTitle(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatRangeLabel(range: DateRange): string {
  if (range.end <= range.start) return '';

  const start = new Date(range.start);
  const lastDay = addDays(range.end, -1);
  const end = new Date(lastDay);

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return formatFullDate(range.start);
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getMonth() + 1}月${start.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`;
  }

  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
}

export function formatRangeLabelWithYear(range: DateRange): string {
  if (range.end <= range.start) return '';

  const start = new Date(range.start);
  const end = new Date(addDays(range.end, -1));

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return formatFullDateWithYear(range.start);
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`;
  }

  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日–${end.getFullYear()}年${end.getMonth() + 1}月${end.getDate()}日`;
}

export function formatBucketTitle(bucket: Bucket): string {
  return bucket.fullLabel;
}

/** 42 Monday-first cells; nulls are padding outside the requested month. */
export function buildMonthGrid(
  year: number,
  month: number,
): (number | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > daysInMonth) return null;
    return new Date(year, month, day).getTime();
  });
}

export function isSameDay(a: number, b: number): boolean {
  return dayStart(a) === dayStart(b);
}
