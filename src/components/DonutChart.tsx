import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { colors } from '../theme';
import type { ActivityGroup, CategoryGroup } from '../utils/analytics';
import { layoutCategoryLabels } from '../utils/categoryLabels';
import { buildDonutArcs } from '../utils/donut';
import {
  DONUT_LABEL,
  layoutDonutLabels,
} from '../utils/donutLabels';
import { DonutRing } from './DonutRing';

interface DonutChartProps {
  categories: CategoryGroup[];
  activities: ActivityGroup[];
  totalMs: number;
  accessibilityLabel: string;
  variant?: 'activity' | 'category';
  showDirectLabels?: boolean;
  gapColor?: string;
  selectedActivityKey?: string | null;
  onSelectActivity?: (key: string) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function DonutChart({
  categories,
  activities,
  totalMs,
  accessibilityLabel,
  variant = 'activity',
  showDirectLabels = false,
  gapColor = colors.page,
  selectedActivityKey = null,
  onSelectActivity,
}: DonutChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const interactive =
    variant === 'activity' && onSelectActivity !== undefined;
  const selectedKey = interactive ? selectedActivityKey : null;
  const total =
    totalMs > 0
      ? totalMs
      : categories.reduce((sum, category) => sum + category.ms, 0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  if (total <= 0) return null;

  const fullWidth = containerWidth > 0 ? containerWidth : 280;
  const activityLabelLayout =
    showDirectLabels &&
    variant === 'activity' &&
    activities.some((activity) => activity.ms > 0)
      ? layoutDonutLabels(activities, total, fullWidth)
      : null;
  const categoryLabelLayout =
    showDirectLabels && variant === 'category'
      ? layoutCategoryLabels(
          categories.map((category) => ({
            key: category.id,
            label: category.label,
            color: category.color,
            ms: category.ms,
          })),
          total,
          fullWidth,
        )
      : null;
  const directLayout = categoryLabelLayout ?? activityLabelLayout;

  const size = directLayout
    ? directLayout.size
    : clamp(fullWidth, 160, 260);
  const centerX = directLayout ? directLayout.centerX : fullWidth / 2;
  const height = directLayout ? directLayout.height : size + 8;
  const centerY = directLayout ? directLayout.centerY : height / 2;

  const categoryArcs =
    categoryLabelLayout?.arcs ??
    buildDonutArcs(
      categories.map((category) => ({
        key: category.id,
        color: category.color,
        ms: category.ms,
      })),
      total,
    );
  const activityArcs =
    activityLabelLayout?.arcs ??
    buildDonutArcs(
      activities.map((activity) => ({
        key: activity.key,
        color: activity.color,
        ms: activity.ms,
      })),
      total,
    );

  const ringOuter = directLayout
    ? directLayout.ringOuter
    : size * 0.47;
  const ringInner = directLayout
    ? directLayout.ringInner
    : size * (variant === 'category' ? 0.25 : 0.27);
  const outsideLabelSpan = variant === 'category' ? ringOuter : size / 2;
  const slots = directLayout?.slots ?? [];
  const insideLabels = categoryLabelLayout?.insideLabels ?? [];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        interactive ? '点击扇区可高亮下方对应活动' : undefined
      }
      onLayout={handleLayout}
      style={[styles.container, { width: '100%', height }]}
    >
      <Svg width={fullWidth} height={height}>
        <DonutRing
          arcs={variant === 'activity' ? activityArcs : categoryArcs}
          cx={centerX}
          cy={centerY}
          outerRadius={ringOuter}
          innerRadius={ringInner}
          gapColor={gapColor}
          selectedKey={selectedKey}
          onSelect={interactive ? onSelectActivity : undefined}
        />

        {slots.map((slot) => {
          const labelEdge =
            slot.side === 'right'
              ? centerX + outsideLabelSpan + DONUT_LABEL.labelGap
              : centerX - outsideLabelSpan - DONUT_LABEL.labelGap;
          const dimmed =
            selectedKey !== null && selectedKey !== slot.key;

          return (
            <Polyline
              key={`line-${slot.key}`}
              points={[
                `${slot.anchorX},${slot.anchorY}`,
                `${slot.busX},${slot.anchorY}`,
                `${slot.busX},${slot.centerY}`,
                `${labelEdge},${slot.centerY}`,
              ].join(' ')}
              fill="none"
              stroke={slot.color}
              strokeOpacity={dimmed ? 0.2 : 0.55}
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        })}

        {slots.map((slot) => (
          <Circle
            key={`dot-${slot.key}`}
            cx={slot.anchorX}
            cy={slot.anchorY}
            r={2.2}
            fill={slot.color}
            fillOpacity={
              selectedKey !== null && selectedKey !== slot.key
                ? 0.35
                : 1
            }
            stroke={gapColor}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {directLayout ? (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={StyleSheet.absoluteFill}
        >
          {slots.map((slot) => {
            const selected = selectedKey === slot.key;
            const dimmed = selectedKey !== null && !selected;

            return (
              <View
                key={`label-${slot.key}`}
                style={[
                  styles.directLabel,
                  {
                    left: slot.labelLeft,
                    top: slot.top,
                    width: slot.labelWidth,
                    height: DONUT_LABEL.slotHeight,
                    alignItems:
                      slot.textAlign === 'right'
                        ? 'flex-end'
                        : 'flex-start',
                    opacity: dimmed ? 0.35 : 1,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={
                    variant === 'category' ? 1 : DONUT_LABEL.maxLines
                  }
                  ellipsizeMode="tail"
                  style={[
                    styles.labelText,
                    { textAlign: slot.textAlign },
                    selected && styles.labelTextSelected,
                  ]}
                >
                  {slot.label}
                </Text>
              </View>
            );
          })}

          {insideLabels.map((label) => (
            <View
              key={`inside-${label.key}`}
              style={[
                styles.insideLabel,
                {
                  left: label.x - label.width / 2,
                  top: label.y - label.height / 2,
                  width: label.width,
                  height: label.height,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.insideLabelText,
                  { color: label.textColor },
                ]}
              >
                {label.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    overflow: 'visible',
  },
  directLabel: {
    position: 'absolute',
    justifyContent: 'center',
  },
  labelText: {
    maxWidth: '100%',
    includeFontPadding: false,
    fontSize: DONUT_LABEL.fontSize,
    lineHeight: DONUT_LABEL.lineHeight,
    fontWeight: '500',
    color: colors.text,
  },
  labelTextSelected: {
    fontWeight: '600',
  },
  insideLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insideLabelText: {
    includeFontPadding: false,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
