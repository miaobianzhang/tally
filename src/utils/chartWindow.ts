export interface WindowRange {
  first: number;
  last: number;
}

export function computeVisibleRange(
  scrollX: number,
  slotWidth: number,
  plotWidth: number,
  totalDays: number,
  overscan: number,
): WindowRange {
  if (totalDays <= 0 || slotWidth <= 0) return { first: 0, last: 0 };
  const first = Math.max(
    0,
    Math.min(
      totalDays - 1,
      Math.floor(scrollX / slotWidth) - overscan,
    ),
  );
  const last = Math.max(
    0,
    Math.min(
      totalDays - 1,
      Math.ceil((scrollX + plotWidth) / slotWidth) + overscan,
    ),
  );
  return { first: Math.min(first, last), last };
}

export function shouldUpdateWindow(
  current: WindowRange,
  next: WindowRange,
  threshold = 4,
): boolean {
  if (next.first === current.first && next.last === current.last) {
    return false;
  }
  return (
    Math.abs(next.first - current.first) >= threshold ||
    Math.abs(next.last - current.last) >= threshold
  );
}
