export interface DonutArc {
  key: string;
  color: string;
  startAngle: number;
  endAngle: number;
}

export interface DonutPoint {
  x: number;
  y: number;
}

export function polar(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): DonutPoint {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function donutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  const outerStart = polar(cx, cy, outerRadius, startAngle);
  const outerEnd = polar(cx, cy, outerRadius, endAngle);
  const innerEnd = polar(cx, cy, innerRadius, endAngle);
  const innerStart = polar(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

/** Fixed category order, clockwise from 12 o'clock. */
export function buildDonutArcs(
  items: readonly { key: string; color: string; ms: number }[],
  totalMs: number,
): DonutArc[] {
  if (totalMs <= 0) return [];

  let offset = 0;
  return items.map((item) => {
    const startAngle = -Math.PI / 2 + (offset / totalMs) * Math.PI * 2;
    const endAngle = startAngle + (item.ms / totalMs) * Math.PI * 2;
    offset += item.ms;

    return {
      key: item.key,
      color: item.color,
      startAngle,
      endAngle,
    };
  });
}

export function arcMidAngle(arc: DonutArc): number {
  return (arc.startAngle + arc.endAngle) / 2;
}
