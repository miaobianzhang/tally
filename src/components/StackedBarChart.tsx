import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path, Rect } from 'react-native-svg';

import { FALLBACK_CATEGORY } from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeColors } from '../theme/types';
import type { TrendBucket } from '../utils/analytics';
import {
  bucketCenterX,
  roundedTopBarPath,
  valueY,
} from '../utils/chart';
import { formatDuration } from '../utils/time';
import { ChartFrame } from './ChartFrame';

interface StackedBarChartProps {
  buckets: TrendBucket[];
  maxMs: number;
  onSelectBucket?: (bucket: TrendBucket) => void;
  /** Fit all buckets into the visible width; no horizontal scrolling. */
  fitContent?: boolean;
}

export function StackedBarChart({
  buckets,
  maxMs,
  onSelectBucket,
  fitContent = false,
}: StackedBarChartProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { lookup } = useCategories();

  const categoryOrder = useMemo(() => {
    const ids = lookup.ordered.map((category) => category.id);
    const seen = new Set(ids);
    buckets.forEach((bucket) => {
      Object.keys(bucket.categoryMs).forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
    });
    return ids;
  }, [buckets, lookup.ordered]);

  return (
    <ChartFrame
      buckets={buckets}
      maxMs={maxMs}
      fitContent={fitContent}
      overlay={({ metrics }) =>
        onSelectBucket ? (
          <View style={StyleSheet.absoluteFill}>
            {buckets.map((bucket, index) =>
              bucket.totalMs > 0 ? (
                <Pressable
                  key={bucket.start}
                  accessibilityRole="button"
                  accessibilityLabel={`${bucket.fullLabel}，总计 ${formatDuration(bucket.totalMs)}，点击查看活动明细`}
                  onPress={() => onSelectBucket(bucket)}
                  style={({ pressed }) => [
                    styles.hitTarget,
                    {
                      left: index * metrics.slotWidth,
                      width: metrics.slotWidth,
                      top: metrics.plotTop,
                      height: metrics.plotHeight,
                    },
                    pressed && styles.hitTargetPressed,
                  ]}
                />
              ) : null,
            )}
          </View>
        ) : null
      }
    >
      {({ metrics, yMaxMs }) => (
        <Svg
          width={metrics.contentWidth}
          height={metrics.baselineY}
          pointerEvents="none"
          style={styles.marks}
        >
          {buckets.map((bucket, bucketIndex) => {
            if (bucket.totalMs <= 0 || yMaxMs <= 0) return null;

            const visible = categoryOrder
              .map((categoryId) => ({
                categoryId,
                ms: bucket.categoryMs[categoryId] ?? 0,
              }))
              .filter((segment) => segment.ms > 0);
            const topPosition = visible.length - 1;
            const x =
              bucketCenterX(metrics, bucketIndex) - metrics.barWidth / 2;

            return (
              <G key={bucket.start}>
                {visible.map((segment, position) => {
                  const belowMs = visible
                    .slice(0, position)
                    .reduce((sum, previous) => sum + previous.ms, 0);
                  const bottomY = valueY(metrics, belowMs, yMaxMs);
                  const topY = valueY(
                    metrics,
                    belowMs + segment.ms,
                    yMaxMs,
                  );
                  const height = Math.max(0, bottomY - topY);
                  const color =
                    lookup.byId.get(segment.categoryId)?.color ??
                    FALLBACK_CATEGORY.color;

                  return position === topPosition ? (
                    <Path
                      key={segment.categoryId}
                      d={roundedTopBarPath(
                        x,
                        topY,
                        metrics.barWidth,
                        height,
                        4,
                      )}
                      fill={color}
                    />
                  ) : (
                    <Rect
                      key={segment.categoryId}
                      x={x}
                      y={topY}
                      width={metrics.barWidth}
                      height={height}
                      fill={color}
                    />
                  );
                })}

                {visible.map((segment, position) => {
                  if (position === topPosition) return null;

                  const cumulativeMs = visible
                    .slice(0, position + 1)
                    .reduce((sum, previous) => sum + previous.ms, 0);
                  const boundaryY = valueY(metrics, cumulativeMs, yMaxMs);

                  return (
                    <Line
                      key={`gap-${segment.categoryId}`}
                      x1={x}
                      y1={boundaryY}
                      x2={x + metrics.barWidth}
                      y2={boundaryY}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  );
                })}
              </G>
            );
          })}
        </Svg>
      )}
    </ChartFrame>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  marks: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  hitTarget: {
    position: 'absolute',
    borderRadius: 6,
  },
  hitTargetPressed: {
    backgroundColor: colors.rangeTint,
  },
});
