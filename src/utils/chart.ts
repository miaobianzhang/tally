import { colors } from '../theme';
import type { Bucket, Granularity } from './dateRange';

export interface ChartMetrics {
  /** Plot width visible after the fixed y-axis column. */
  viewportWidth: number;
  /** Full plot width when the chart scrolls horizontally. */
  contentWidth: number;
  /** Plot area plus the x-axis label band. */
  height: number;
  plotTop: number;
  plotHeight: number;
  baselineY: number;
  slotWidth: number;
  barWidth: number;
  xLabelHeight: number;
  scrollable: boolean;
}

export const Y_AXIS_WIDTH = 42;
export const PLOT_TOP = 8;
export const PLOT_HEIGHT = 184;
export const X_LABEL_HEIGHT = 26;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Minutes: 1, 2, 5, 10, 15, 30, then hours and days. Candidates keep every
// axis label readable (15m / 1h / 12h / 2d) while still covering weekly
// buckets as tall as seven days.
const STEP_CANDIDATES_MS = [
  1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880, 4320,
  10080, 20160, 43200,
].map((minutes) => minutes * MINUTE_MS);

export function computeChartMetrics(
  containerWidth: number,
  bucketCount: number,
  granularity: Granularity,
): ChartMetrics {
  const viewportWidth = Math.max(0, containerWidth - Y_AXIS_WIDTH);
  const minSlotWidth = granularity === 'week' ? 32 : 24;
  const contentWidth =
    bucketCount > 0
      ? Math.max(viewportWidth, bucketCount * minSlotWidth)
      : viewportWidth;
  const slotWidth = bucketCount > 0 ? contentWidth / bucketCount : 0;
  const barWidth =
    bucketCount > 0
      ? Math.max(6, Math.min(24, slotWidth * 0.52))
      : 0;
  const height = PLOT_TOP + PLOT_HEIGHT + X_LABEL_HEIGHT;

  return {
    viewportWidth,
    contentWidth,
    height,
    plotTop: PLOT_TOP,
    plotHeight: PLOT_HEIGHT,
    baselineY: PLOT_TOP + PLOT_HEIGHT,
    slotWidth,
    barWidth,
    xLabelHeight: X_LABEL_HEIGHT,
    scrollable: contentWidth > viewportWidth + 0.5,
  };
}

export function niceTimeScale(maxMs: number): {
  maxMs: number;
  ticks: number[];
} {
  if (!Number.isFinite(maxMs) || maxMs <= 0) {
    return { maxMs: 0, ticks: [0] };
  }

  const step =
    STEP_CANDIDATES_MS.find((candidate) => candidate * 4 >= maxMs) ??
    STEP_CANDIDATES_MS[STEP_CANDIDATES_MS.length - 1];

  const niceMax = step * 4;
  return {
    maxMs: niceMax,
    ticks: [0, step, step * 2, step * 3, niceMax],
  };
}

export function selectXTicks(
  buckets: Bucket[],
  metrics: ChartMetrics,
): { index: number; label: string }[] {
  const count = buckets.length;
  if (count === 0) return [];

  // 32px keeps all seven weekday labels on a phone and still leaves roughly
  // one label in every 1.3 slots on longer daily ranges.
  const labelSpacing = 32;
  const maxLabels = Math.max(
    2,
    Math.floor(metrics.contentWidth / labelSpacing),
  );
  // A weekday row is seven labels wide. Keep all seven even on narrow phones,
  // where the spacing calculation above can otherwise drop one (e.g. 周四).
  if (count <= 7 || count <= maxLabels) {
    return buckets.map((bucket, index) => ({
      index,
      label: bucket.label,
    }));
  }

  const ticks: { index: number; label: string }[] = [];
  let previous = -1;

  for (let slot = 0; slot < maxLabels; slot += 1) {
    const index = Math.round((slot * (count - 1)) / (maxLabels - 1));
    if (index === previous) continue;
    ticks.push({ index, label: buckets[index].label });
    previous = index;
  }

  return ticks;
}

export function bucketCenterX(
  metrics: ChartMetrics,
  index: number,
): number {
  return index * metrics.slotWidth + metrics.slotWidth / 2;
}

/**
 * Every point is labelled on short ranges. Longer ranges keep roughly seven
 * evenly spaced callouts so the text stays readable while scrolling.
 */
export function selectPointLabelIndices(bucketCount: number): number[] {
  if (!Number.isFinite(bucketCount) || bucketCount <= 0) return [];

  const count = Math.floor(bucketCount);
  if (count <= 14) {
    return Array.from({ length: count }, (_, index) => index);
  }

  const sampleCount = 7;
  const indices: number[] = [];
  for (let slot = 0; slot < sampleCount; slot += 1) {
    const index = Math.round((slot * (count - 1)) / (sampleCount - 1));
    if (indices[indices.length - 1] !== index) indices.push(index);
  }
  return indices;
}

export interface PointLabelYs {
  studyWork: number;
  total: number;
}

/**
 * Solid labels sit above their own point and dashed labels below theirs.
 * When the lines are close the labels stack into a two-line callout instead.
 */
export function computePointLabelYs(
  studyY: number,
  totalY: number,
  baselineY: number,
): PointLabelYs {
  const minY = 12;
  const maxY = Math.max(minY, baselineY - 4);
  const maxStudyY = Math.max(minY, maxY - 12);

  let studyWork = Math.max(minY, Math.min(maxStudyY, studyY - 7));
  let total = Math.max(minY, Math.min(maxY, totalY + 14));

  if (Math.abs(total - studyWork) < 12) {
    const mid = (studyWork + total) / 2;
    studyWork = Math.max(minY, Math.min(maxStudyY, mid - 6));
    total = Math.min(maxY, studyWork + 12);
  }

  return { studyWork, total };
}

export function valueY(
  metrics: ChartMetrics,
  valueMs: number,
  maxMs: number,
): number {
  if (maxMs <= 0) return metrics.baselineY;
  const ratio = Math.max(0, Math.min(1, valueMs / maxMs));
  return metrics.baselineY - ratio * metrics.plotHeight;
}

export function roundedTopBarPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): string {
  if (w <= 0 || h <= 0) return '';

  const r = Math.max(0, Math.min(radius, w / 2, h));
  const bottom = y + h;

  return [
    `M ${x.toFixed(3)} ${bottom.toFixed(3)}`,
    `L ${x.toFixed(3)} ${(y + r).toFixed(3)}`,
    `Q ${x.toFixed(3)} ${y.toFixed(3)} ${(x + r).toFixed(3)} ${y.toFixed(3)}`,
    `L ${(x + w - r).toFixed(3)} ${y.toFixed(3)}`,
    `Q ${(x + w).toFixed(3)} ${y.toFixed(3)} ${(x + w).toFixed(3)} ${(y + r).toFixed(3)}`,
    `L ${(x + w).toFixed(3)} ${bottom.toFixed(3)}`,
    'Z',
  ].join(' ');
}

export function linePath(
  values: number[],
  metrics: ChartMetrics,
  maxMs: number,
): string {
  if (values.length < 2) return '';

  return values
    .map((value, index) => {
      const x = bucketCenterX(metrics, index);
      const y = valueY(metrics, value, maxMs);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`;
    })
    .join(' ');
}

/** Pick black or white text for a category-colored block. */
export function readableTextColor(hex: string): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return colors.onAccent;

  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const linear = (channel: number) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * linear(red) +
    0.7152 * linear(green) +
    0.0722 * linear(blue);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return blackContrast >= whiteContrast ? colors.text : colors.onAccent;
}

export function formatAxisDuration(ms: number): string {
  if (ms <= 0) return '0';
  if (ms < MINUTE_MS) return '<1m';

  if (ms < HOUR_MS) {
    const minutes = Math.round(ms / MINUTE_MS);
    return `${minutes}m`;
  }

  if (ms < DAY_MS) {
    const hours = ms / HOUR_MS;
    return Number.isInteger(hours)
      ? `${hours}h`
      : `${hours.toFixed(1)}h`;
  }

  const days = ms / DAY_MS;
  return Number.isInteger(days) ? `${days}d` : `${Math.round(days)}d`;
}
