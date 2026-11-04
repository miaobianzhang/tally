import { readableTextColor } from './chart';
import { arcMidAngle, buildDonutArcs, type DonutArc } from './donut';
import {
  DONUT_LABEL,
  donutColumnHeight,
  placeDonutColumn,
  type DonutLabelSlot,
} from './donutLabels';

export const CATEGORY_LABEL = {
  insideFontSize: 10.5,
  insideLineHeight: 13,
  insidePadX: 2,
  insidePadY: 2,
  insideRadialPad: 2.5,
  insideTangentialPad: 3.5,
  outsideGutter: 32,
  outsideGap: DONUT_LABEL.labelGap,
  slotHeight: DONUT_LABEL.slotHeight,
  slotGap: DONUT_LABEL.slotGap,
  verticalPad: DONUT_LABEL.verticalPad,
  minHeight: 200,
  fullMinSize: 160,
  fullMaxSize: 260,
  gutterMinSize: 100,
  outerRatioFull: 0.47,
  innerOuterRatio: 0.532,
} as const;

export interface CategoryLabelInput {
  key: string;
  label: string;
  color: string;
  ms: number;
}

export interface CategoryInsideLabel {
  key: string;
  label: string;
  textColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CategoryLabelLayout {
  width: number;
  height: number;
  size: number;
  centerX: number;
  centerY: number;
  ringOuter: number;
  ringInner: number;
  arcs: DonutArc[];
  insideLabels: CategoryInsideLabel[];
  slots: DonutLabelSlot[];
  usedGutters: boolean;
}

interface LabelBox {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((((angle + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

/** Approximate glyph width: CJK/fullwidth counts one em, ASCII 0.55 em. */
export function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  Array.from(text).forEach((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const isWide =
      codePoint >= 0x2e80 ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff);
    width += isWide ? fontSize : fontSize * 0.55;
  });
  return width;
}

/**
 * Whether an axis-aligned label box at the arc midpoint stays inside the ring
 * band and away from both radial edges. Sampling the four corners and four
 * edge midpoints is conservative enough for the fixed two-character labels.
 */
export function categoryLabelFitsArc(
  box: LabelBox,
  arc: DonutArc,
  centerX: number,
  centerY: number,
  ringOuter: number,
  ringInner: number,
): boolean {
  const sweep = arc.endAngle - arc.startAngle;
  if (sweep <= 0 || ringOuter <= ringInner) return false;

  const mid = arcMidAngle(arc);
  const midRadius = (ringOuter + ringInner) / 2;
  const midX = centerX + midRadius * Math.cos(mid);
  const midY = centerY + midRadius * Math.sin(mid);

  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  const samples: [number, number][] = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [-halfWidth, halfHeight],
    [halfWidth, halfHeight],
    [0, -halfHeight],
    [0, halfHeight],
    [-halfWidth, 0],
    [halfWidth, 0],
  ];

  const halfSweep = sweep / 2 - CATEGORY_LABEL.insideTangentialPad / midRadius;
  if (halfSweep <= 0) return false;

  return samples.every(([dx, dy]) => {
    const x = midX + dx;
    const y = midY + dy;
    const radius = Math.hypot(x - centerX, y - centerY);
    if (radius < ringInner + CATEGORY_LABEL.insideRadialPad) return false;
    if (radius > ringOuter - CATEGORY_LABEL.insideRadialPad) return false;

    const delta = Math.abs(
      normalizeAngle(Math.atan2(y - centerY, x - centerX) - mid),
    );
    return delta <= halfSweep;
  });
}

function makeBoxes(items: readonly CategoryLabelInput[]): LabelBox[] {
  return items.map((item) => ({
    width: Math.ceil(
      estimateTextWidth(item.label, CATEGORY_LABEL.insideFontSize) +
        CATEGORY_LABEL.insidePadX * 2,
    ),
    height:
      CATEGORY_LABEL.insideLineHeight + CATEGORY_LABEL.insidePadY * 2,
  }));
}

function buildInsideLabels(
  items: readonly CategoryLabelInput[],
  arcs: readonly DonutArc[],
  centerX: number,
  centerY: number,
  ringOuter: number,
  ringInner: number,
  fits: readonly boolean[],
  boxes: readonly LabelBox[],
): CategoryInsideLabel[] {
  const midRadius = (ringOuter + ringInner) / 2;
  const labels: CategoryInsideLabel[] = [];

  items.forEach((item, index) => {
    if (!fits[index]) return;
    const mid = arcMidAngle(arcs[index]);
    labels.push({
      key: item.key,
      label: item.label,
      textColor: readableTextColor(item.color),
      x: centerX + midRadius * Math.cos(mid),
      y: centerY + midRadius * Math.sin(mid),
      width: boxes[index].width,
      height: boxes[index].height,
    });
  });

  return labels;
}

function buildOutsideSlots(
  items: readonly CategoryLabelInput[],
  arcs: readonly DonutArc[],
  fits: readonly boolean[],
  centerX: number,
  centerY: number,
  ringOuter: number,
  columnWidth: number,
): DonutLabelSlot[] {
  const slots: DonutLabelSlot[] = [];
  const sideCounts = { left: 0, right: 0 };

  items.forEach((item, index) => {
    if (fits[index]) return;
    const mid = arcMidAngle(arcs[index]);
    const side = Math.cos(mid) >= 0 ? 'right' : 'left';
    const stagger = sideCounts[side];
    sideCounts[side] += 1;

    slots.push({
      key: item.key,
      label: item.label,
      color: item.color,
      side,
      anchorX: 0,
      anchorY: 0,
      busX:
        centerX +
        (side === 'right' ? 1 : -1) *
          (ringOuter + 1.5 + (stagger % 3)),
      top: 0,
      centerY: 0,
      labelLeft:
        side === 'right'
          ? centerX + ringOuter + CATEGORY_LABEL.outsideGap
          : 0,
      labelWidth: columnWidth,
      textAlign: side === 'right' ? 'left' : 'right',
    });
  });

  const anchorRadius = ringOuter + 2;
  const byKey = new Map(
    items.map((item, index) => [item.key, { item, arc: arcs[index] }]),
  );

  slots.forEach((slot) => {
    const entry = byKey.get(slot.key);
    if (!entry) return;
    const mid = arcMidAngle(entry.arc);
    slot.anchorX = centerX + anchorRadius * Math.cos(mid);
    slot.anchorY = centerY + anchorRadius * Math.sin(mid);
  });

  return slots;
}

function emptyLayout(
  width: number,
  size: number,
  ringOuter: number,
  ringInner: number,
): CategoryLabelLayout {
  const height = size + 8;
  return {
    width,
    height,
    size,
    centerX: width / 2,
    centerY: height / 2,
    ringOuter,
    ringInner,
    arcs: [],
    insideLabels: [],
    slots: [],
    usedGutters: false,
  };
}

/**
 * Labels a category ring. Categories whose names fit inside the band get an
 * in-band label; the rest go to leader-line slots outside. Only when outside
 * slots are needed does the ring reserve a gutter on both sides.
 */
export function layoutCategoryLabels(
  items: readonly CategoryLabelInput[],
  totalMs: number,
  width: number,
): CategoryLabelLayout {
  const safeWidth = Math.max(1, width);
  const entries = items.filter((item) => item.ms > 0);

  if (entries.length === 0 || totalMs <= 0) {
    const size = clamp(
      safeWidth,
      CATEGORY_LABEL.fullMinSize,
      CATEGORY_LABEL.fullMaxSize,
    );
    const ringOuter = size * CATEGORY_LABEL.outerRatioFull;
    return emptyLayout(
      safeWidth,
      size,
      ringOuter,
      ringOuter * CATEGORY_LABEL.innerOuterRatio,
    );
  }

  const arcs = buildDonutArcs(entries, totalMs);
  const boxes = makeBoxes(entries);

  const fullSize = clamp(
    safeWidth,
    CATEGORY_LABEL.fullMinSize,
    CATEGORY_LABEL.fullMaxSize,
  );
  const fullOuter = fullSize * CATEGORY_LABEL.outerRatioFull;
  const fullInner = fullOuter * CATEGORY_LABEL.innerOuterRatio;
  const fullHeight = fullSize + 8;
  const fullCenterX = safeWidth / 2;
  const fullCenterY = fullHeight / 2;
  const fullFits = arcs.map((arc, index) =>
    categoryLabelFitsArc(
      boxes[index],
      arc,
      fullCenterX,
      fullCenterY,
      fullOuter,
      fullInner,
    ),
  );

  if (fullFits.every(Boolean)) {
    return {
      width: safeWidth,
      height: fullHeight,
      size: fullSize,
      centerX: fullCenterX,
      centerY: fullCenterY,
      ringOuter: fullOuter,
      ringInner: fullInner,
      arcs,
      insideLabels: buildInsideLabels(
        entries,
        arcs,
        fullCenterX,
        fullCenterY,
        fullOuter,
        fullInner,
        fullFits,
        boxes,
      ),
      slots: [],
      usedGutters: false,
    };
  }

  // Outside labels need a gutter per side; shrinking the ring just enough
  // keeps the chart as large as possible while guaranteeing label room.
  const gutterSize = clamp(
    safeWidth - CATEGORY_LABEL.outsideGutter * 2,
    CATEGORY_LABEL.gutterMinSize,
    CATEGORY_LABEL.fullMaxSize,
  );
  const ringOuter = gutterSize / 2;
  const ringInner = ringOuter * CATEGORY_LABEL.innerOuterRatio;
  const columnWidth = Math.max(
    24,
    (safeWidth - gutterSize) / 2 - CATEGORY_LABEL.outsideGap,
  );
  const fits = arcs.map((arc, index) =>
    categoryLabelFitsArc(
      boxes[index],
      arc,
      fullCenterX,
      0,
      ringOuter,
      ringInner,
    ),
  );

  const leftCount = fits.filter(
    (fitsInside, index) => !fitsInside && Math.cos(arcMidAngle(arcs[index])) < 0,
  ).length;
  const rightCount = fits.length - leftCount - fits.filter(Boolean).length;

  const height = Math.max(
    gutterSize + 28,
    donutColumnHeight(leftCount),
    donutColumnHeight(rightCount),
    CATEGORY_LABEL.minHeight,
  );
  const centerX = fullCenterX;
  const centerY = height / 2;

  // The fit test uses the same radius at both y values; only the center moves.
  const finalFits = arcs.map((arc, index) =>
    categoryLabelFitsArc(
      boxes[index],
      arc,
      centerX,
      centerY,
      ringOuter,
      ringInner,
    ),
  );

  const insideLabels = buildInsideLabels(
    entries,
    arcs,
    centerX,
    centerY,
    ringOuter,
    ringInner,
    finalFits,
    boxes,
  );
  const slots = buildOutsideSlots(
    entries,
    arcs,
    finalFits,
    centerX,
    centerY,
    ringOuter,
    columnWidth,
  );

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
    size: gutterSize,
    centerX,
    centerY,
    ringOuter,
    ringInner,
    arcs,
    insideLabels,
    slots,
    usedGutters: true,
  };
}
