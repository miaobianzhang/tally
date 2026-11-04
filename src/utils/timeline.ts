import { getCategory } from '../constants/categories';
import type { CategoryId, Session } from '../types';
import {
  eachDay,
  formatMonthDay,
  formatWeekdayShort,
  type DateRange,
} from './dateRange';
import { normalizeActivityLabel } from './analytics';
import { formatClockTime, nextDayStart } from './time';

export interface TimelineSegment {
  /** Unique after a cross-midnight session is split by day. */
  id: string;
  sessionId: string;
  dayStart: number;
  /** Absolute timestamps clipped to the day. */
  start: number;
  end: number;
  ms: number;
  activity: string;
  category: CategoryId;
  categoryLabel: string;
  color: string;
  sessionStart: number;
  sessionEnd: number;
  crossesMidnight: boolean;
}

export interface TimelineDay {
  start: number;
  end: number;
  label: string;
  dateLabel: string;
  segments: TimelineSegment[];
  totalMs: number;
}

export function minutesOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return (
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60
  );
}

export function formatSegmentRange(
  segment: TimelineSegment,
  day: TimelineDay,
): string {
  const end =
    segment.end >= day.end ? '24:00' : formatClockTime(segment.end);
  return `${formatClockTime(segment.start)}–${end}`;
}

export function buildTimelineDays(
  sessions: Session[],
  range: DateRange,
): TimelineDay[] {
  const days = eachDay(range).map<TimelineDay>((start) => ({
    start,
    end: nextDayStart(start),
    label: formatWeekdayShort(start),
    dateLabel: formatMonthDay(start),
    segments: [],
    totalMs: 0,
  }));

  sessions.forEach((session) => {
    if (
      !Number.isFinite(session.startedAt) ||
      !Number.isFinite(session.endedAt) ||
      session.endedAt <= session.startedAt
    ) {
      return;
    }

    const category = getCategory(session.category);
    const activity = normalizeActivityLabel(session.activity) || '未填写活动';

    days.forEach((day) => {
      const start = Math.max(session.startedAt, day.start);
      const end = Math.min(session.endedAt, day.end);
      if (end <= start) return;

      day.segments.push({
        id: `${session.id}|${day.start}`,
        sessionId: session.id,
        dayStart: day.start,
        start,
        end,
        ms: end - start,
        activity,
        category: session.category,
        categoryLabel: category.label,
        color: category.color,
        sessionStart: session.startedAt,
        sessionEnd: session.endedAt,
        crossesMidnight:
          session.startedAt < day.start || session.endedAt > day.end,
      });
      day.totalMs += end - start;
    });
  });

  days.forEach((day) => {
    day.segments.sort(
      (a, b) =>
        a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
    );
  });

  return days;
}
