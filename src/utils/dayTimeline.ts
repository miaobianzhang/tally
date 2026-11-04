import {
  minutesOfDay,
  type TimelineDay,
  type TimelineSegment,
} from './timeline';

export const DAY_TIMELINE = {
  axisWidth: 36,
  axisGap: 8,
  hourHeight: 48,
  pxPerMinute: 0.8,
  trackHeight: 48 * 24,
  blockInset: 1,
  minBlockHeight: 3,
  barWidth: 48,
  barGap: 10,
  labelLeft: 58,
  labelPadLeft: 2,
  labelPadRight: 4,
  connectorStartX: 47,
  connectorEndX: 58,
  connectorBusXs: [50, 52, 54] as const,
  tickStepHours: 2,
} as const;

export type DayLabelMode = 'twoLine' | 'title' | 'compact' | 'dense';

export const DAY_LABEL_METRICS: Record<
  DayLabelMode,
  {
    height: number;
    gap: number;
    titleFontSize: number;
    titleLineHeight: number;
    showMeta: boolean;
  }
> = {
  twoLine: {
    height: 30,
    gap: 4,
    titleFontSize: 10.5,
    titleLineHeight: 13,
    showMeta: true,
  },
  title: {
    height: 18,
    gap: 3,
    titleFontSize: 10.5,
    titleLineHeight: 13,
    showMeta: false,
  },
  compact: {
    height: 15,
    gap: 1,
    titleFontSize: 10,
    titleLineHeight: 12,
    showMeta: false,
  },
  dense: {
    height: 13,
    gap: 0,
    titleFontSize: 9.5,
    titleLineHeight: 12,
    showMeta: false,
  },
};

export interface DayTimelineLabel {
  top: number;
  height: number;
  left: number;
  width: number;
  anchorY: number;
  centerY: number;
  busX: number;
  mode: DayLabelMode;
}

export interface DayTimelineBlock {
  segment: TimelineSegment;
  rawTop: number;
  rawHeight: number;
  top: number;
  height: number;
  label: DayTimelineLabel;
}

export interface DayTimelineLayout {
  width: number;
  axisWidth: number;
  axisGap: number;
  trackLeft: number;
  trackWidth: number;
  height: number;
  barWidth: number;
  labelLeft: number;
  labelWidth: number;
  labelMode: DayLabelMode;
  hourTicks: { hour: number; lineTop: number; labelTop: number }[];
  blocks: DayTimelineBlock[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function labelCapacity(height: number, gap: number): number {
  return Math.max(
    0,
    Math.floor((DAY_TIMELINE.trackHeight + gap) / (height + gap)),
  );
}

/** Pick the widest label style whose stack still fits the 24-hour track. */
export function pickLabelMode(count: number): DayLabelMode {
  if (count <= labelCapacity(30, 4)) return 'twoLine';
  if (count <= labelCapacity(18, 3)) return 'title';
  if (count <= labelCapacity(15, 1)) return 'compact';
  return 'dense';
}

/**
 * Places every saved segment on a true 0–24 clock axis. Each block is a narrow
 * colored bar at its real position and duration; its label lives in the lane
 * to the right and is packed against other labels.
 */
export function layoutDayTimeline(
  segments: readonly TimelineSegment[],
  day: TimelineDay,
  width: number,
): DayTimelineLayout {
  const safeWidth = Math.max(1, width);
  const axisWidth = Math.min(DAY_TIMELINE.axisWidth, safeWidth);
  const trackLeft = axisWidth + DAY_TIMELINE.axisGap;
  const trackWidth = Math.max(0, safeWidth - trackLeft);
  const height = DAY_TIMELINE.trackHeight;
  const labelWidth = Math.max(0, trackWidth - DAY_TIMELINE.labelLeft);

  const hourTicks: DayTimelineLayout['hourTicks'] = [];
  for (
    let hour = 0;
    hour <= 24;
    hour += DAY_TIMELINE.tickStepHours
  ) {
    const lineTop = hour * DAY_TIMELINE.hourHeight;
    hourTicks.push({
      hour,
      lineTop,
      labelTop: clamp(lineTop - 6, 0, height - 12),
    });
  }

  const ordered = [...segments].sort(
    (a, b) =>
      a.start - b.start || a.end - b.end || a.id.localeCompare(b.id),
  );
  const mode = pickLabelMode(ordered.length);
  const metrics = DAY_LABEL_METRICS[mode];

  const blocks: DayTimelineBlock[] = ordered.map((segment) => {
    const startMin = clamp(minutesOfDay(segment.start), 0, 1440);
    const endMin =
      segment.end >= day.end
        ? 1440
        : clamp(minutesOfDay(segment.end), 0, 1440);
    const rawTop = startMin * DAY_TIMELINE.pxPerMinute;
    const rawHeight =
      Math.max(0, endMin - startMin) * DAY_TIMELINE.pxPerMinute;
    const top = clamp(
      rawTop + DAY_TIMELINE.blockInset,
      0,
      height - DAY_TIMELINE.minBlockHeight,
    );
    const blockHeight = Math.max(
      DAY_TIMELINE.minBlockHeight,
      Math.min(
        rawHeight - DAY_TIMELINE.blockInset * 2,
        height - top,
      ),
    );

    return {
      segment,
      rawTop,
      rawHeight,
      top,
      height: blockHeight,
      label: {
        top: 0,
        height: metrics.height,
        left: DAY_TIMELINE.labelLeft,
        width: labelWidth,
        anchorY: top + blockHeight / 2,
        centerY: 0,
        busX: DAY_TIMELINE.connectorBusXs[0],
        mode,
      },
    };
  });

  if (blocks.length > 0) {
    const entries = blocks
      .map((block, index) => ({
        block,
        index,
        desiredTop: clamp(
          block.top + block.height / 2 - metrics.height / 2,
          0,
          height - metrics.height,
        ),
        top: 0,
      }))
      .sort(
        (a, b) =>
          a.desiredTop - b.desiredTop ||
          a.block.segment.start - b.block.segment.start ||
          a.block.segment.id.localeCompare(b.block.segment.id),
      );

    let cursor = 0;
    entries.forEach((entry) => {
      entry.top = Math.max(entry.desiredTop, cursor);
      cursor = entry.top + metrics.height + metrics.gap;
    });

    const last = entries[entries.length - 1];
    if (last.top + metrics.height > height) {
      cursor = height;
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        entry.top = Math.min(entry.top, cursor - metrics.height);
        cursor = entry.top - metrics.gap;
      }
    }

    entries.forEach((entry) => {
      const top = clamp(entry.top, 0, height - metrics.height);
      const label = entry.block.label;
      label.top = top;
      label.centerY = top + metrics.height / 2;
      label.busX =
        DAY_TIMELINE.connectorBusXs[
          entry.index % DAY_TIMELINE.connectorBusXs.length
        ];
    });
  }

  return {
    width: safeWidth,
    axisWidth,
    axisGap: DAY_TIMELINE.axisGap,
    trackLeft,
    trackWidth,
    height,
    barWidth: DAY_TIMELINE.barWidth,
    labelLeft: DAY_TIMELINE.labelLeft,
    labelWidth,
    labelMode: mode,
    hourTicks,
    blocks,
  };
}
