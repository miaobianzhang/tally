import {
  arcMidAngle,
  buildDonutArcs,
  type DonutArc,
} from './donut';

export const DONUT_LABEL = {
  ringWidthRatio: 0.55,
  minSize: 154,
  maxSize: 240,
  ringOuterRatio: 0.47,
  ringInnerRatio: 0.27,
  labelGap: 6,
  slotHeight: 28,
  slotGap: 5,
  verticalPad: 8,
  minColumnWidth: 44,
  fontSize: 10.5,
  lineHeight: 13,
  maxLines: 2,
} as const;

export interface DonutLabelInput {
  key: string;
  label: string;
  color: string;
  ms: number;
}

export interface DonutLabelSlot {
  key: string;
  label: string;
  color: string;
  side: 'left' | 'right';
  anchorX: number;
  anchorY: number;
  busX: number;
  top: number;
  centerY: number;
  labelLeft: number;
  labelWidth: number;
  textAlign: 'left' | 'right';
}

export interface DonutLabelLayout {
  width: number;
  height: number;
  size: number;
  centerX: number;
  centerY: number;
  ringOuter: number;
  ringInner: number;
  columnWidth: number;
  arcs: DonutArc[];
  slots: DonutLabelSlot[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function donutColumnHeight(count: number): number {
  if (count === 0) return 0;
  return (
    DONUT_LABEL.verticalPad * 2 +
    count * DONUT_LABEL.slotHeight +
    (count - 1) * DONUT_LABEL.slotGap
  );
}

export function placeDonutColumn(
  slots: DonutLabelSlot[],
  height: number,
): void {
  if (slots.length === 0) return;

  // Forward pass preserves reading order and never overlaps. The backward pass
  // pulls the whole stack up when it would spill past the bottom edge.
  let cursor = DONUT_LABEL.verticalPad;
  slots.forEach((slot) => {
    const desiredTop = clamp(
      slot.anchorY - DONUT_LABEL.slotHeight / 2,
      DONUT_LABEL.verticalPad,
      height - DONUT_LABEL.verticalPad - DONUT_LABEL.slotHeight,
    );
    slot.top = Math.max(cursor, desiredTop);
    cursor = slot.top + DONUT_LABEL.slotHeight + DONUT_LABEL.slotGap;
  });

  cursor = height - DONUT_LABEL.verticalPad;
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slot = slots[index];
    slot.top = Math.min(slot.top, cursor - DONUT_LABEL.slotHeight);
    cursor = slot.top - DONUT_LABEL.slotGap;
  }

  slots.forEach((slot) => {
    slot.centerY = slot.top + DONUT_LABEL.slotHeight / 2;
  });
}

/**
 * Places one leader-line label per activity around a single ring. Labels are
 * fixed-height slots so the layout never depends on Android text measurement;
 * the chart grows taller instead of dropping or overlapping a label.
 */
export function layoutDonutLabels(
  activities: readonly DonutLabelInput[],
  totalMs: number,
  width: number,
): DonutLabelLayout {
  const safeWidth = Math.max(1, width);
  const size = clamp(
    safeWidth * DONUT_LABEL.ringWidthRatio,
    DONUT_LABEL.minSize,
    DONUT_LABEL.maxSize,
  );
  const centerX = safeWidth / 2;
  const columnWidth = Math.max(
    DONUT_LABEL.minColumnWidth,
    (safeWidth - size) / 2 - DONUT_LABEL.labelGap,
  );
  const ringOuter = size * DONUT_LABEL.ringOuterRatio;
  const ringInner = size * DONUT_LABEL.ringInnerRatio;
  const arcs = buildDonutArcs(activities, totalMs);

  if (arcs.length === 0 || totalMs <= 0) {
    return {
      width: safeWidth,
      height: 0,
      size,
      centerX,
      centerY: 0,
      ringOuter,
      ringInner,
      columnWidth,
      arcs: [],
      slots: [],
    };
  }

  const slots: DonutLabelSlot[] = [];
  let leftCount = 0;
  let rightCount = 0;

  arcs.forEach((arc, index) => {
    const activity = activities[index];
    const angle =
      arcs.length === 1 ? -Math.PI / 2 : arcMidAngle(arc);
    const side = Math.cos(angle) >= 0 ? 'right' : 'left';
    const stagger = side === 'right' ? rightCount : leftCount;
    if (side === 'right') rightCount += 1;
    else leftCount += 1;

    slots.push({
      key: arc.key,
      label: activity.label,
      color: activity.color,
      side,
      anchorX: 0,
      anchorY: 0,
      // Stagger the vertical bus so parallel leader lines stay separate.
      busX:
        centerX +
        (side === 'right' ? 1 : -1) *
          (size / 2 + 1.5 + (stagger % 3)),
      top: 0,
      centerY: 0,
      labelLeft:
        side === 'right'
          ? centerX + size / 2 + DONUT_LABEL.labelGap
          : 0,
      labelWidth: columnWidth,
      textAlign: side === 'right' ? 'left' : 'right',
    });
  });

  const height = Math.max(
    size + 28,
    donutColumnHeight(leftCount),
    donutColumnHeight(rightCount),
    200,
  );
  const centerY = height / 2;
  const anchorRadius = ringOuter + 2;

  slots.forEach((slot, index) => {
    const arc = arcs[index];
    const angle =
      arcs.length === 1 ? -Math.PI / 2 : arcMidAngle(arc);
    slot.anchorX = centerX + anchorRadius * Math.cos(angle);
    slot.anchorY = centerY + anchorRadius * Math.sin(angle);
  });

  const leftSlots = slots
    .filter((slot) => slot.side === 'left')
    .sort((a, b) => a.anchorY - b.anchorY || a.key.localeCompare(b.key));
  const rightSlots = slots
    .filter((slot) => slot.side === 'right')
    .sort((a, b) => a.anchorY - b.anchorY || a.key.localeCompare(b.key));

  placeDonutColumn(leftSlots, height);
  placeDonutColumn(rightSlots, height);

  return {
    width: safeWidth,
    height,
    size,
    centerX,
    centerY,
    ringOuter,
    ringInner,
    columnWidth,
    arcs,
    slots,
  };
}
