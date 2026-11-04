import { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';
import {
  donutSlicePath,
  type DonutArc,
} from '../utils/donut';

interface DonutRingProps {
  arcs: DonutArc[];
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  /** Color behind the 2px wedge gaps. */
  gapColor?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}

export function DonutRing({
  arcs,
  cx,
  cy,
  outerRadius,
  innerRadius,
  gapColor = colors.page,
  selectedKey = null,
  onSelect,
}: DonutRingProps) {
  if (arcs.length === 0) return null;

  if (arcs.length === 1) {
    const arc = arcs[0];
    return (
      <Circle
        cx={cx}
        cy={cy}
        r={(outerRadius + innerRadius) / 2}
        fill="none"
        stroke={arc.color}
        strokeOpacity={
          selectedKey !== null && selectedKey !== arc.key ? 0.35 : 1
        }
        strokeWidth={outerRadius - innerRadius}
        onPress={onSelect ? () => onSelect(arc.key) : undefined}
      />
    );
  }

  return (
    <>
      {arcs.map((arc) => (
        <Path
          key={arc.key}
          d={donutSlicePath(
            cx,
            cy,
            outerRadius,
            innerRadius,
            arc.startAngle,
            arc.endAngle,
          )}
          fill={arc.color}
          fillOpacity={
            selectedKey !== null && selectedKey !== arc.key ? 0.35 : 1
          }
          stroke={gapColor}
          strokeWidth={2}
          onPress={onSelect ? () => onSelect(arc.key) : undefined}
        />
      ))}
    </>
  );
}
