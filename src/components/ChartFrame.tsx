import { useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { colors } from '../theme';
import {
  bucketCenterX,
  computeChartMetrics,
  formatAxisDuration,
  niceTimeScale,
  selectXTicks,
  valueY,
  Y_AXIS_WIDTH,
  type ChartMetrics,
} from '../utils/chart';
import type { Bucket } from '../utils/dateRange';

export interface ChartFrameData {
  metrics: ChartMetrics;
  yMaxMs: number;
  yTicks: number[];
  xTicks: { index: number; label: string }[];
}

interface ChartFrameProps {
  buckets: Bucket[];
  maxMs: number;
  children: (frame: ChartFrameData) => ReactNode;
  overlay?: (frame: ChartFrameData) => ReactNode;
}

export function ChartFrame({
  buckets,
  maxMs,
  children,
  overlay,
}: ChartFrameProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const granularity = buckets[0]?.granularity ?? 'day';
  const metrics = computeChartMetrics(
    containerWidth,
    buckets.length,
    granularity,
  );
  const scale = niceTimeScale(maxMs);
  const frame: ChartFrameData = {
    metrics,
    yMaxMs: scale.maxMs,
    yTicks: scale.ticks,
    xTicks: selectXTicks(buckets, metrics),
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== containerWidth) {
      setContainerWidth(nextWidth);
    }
  };

  return (
    <View style={[styles.frame, { height: metrics.height }]}>
      <View style={[styles.yAxis, { height: metrics.height }]}>
        {frame.yTicks.map((tick) => (
          <Text
            key={tick}
            style={[
              styles.yLabel,
              { top: valueY(metrics, tick, frame.yMaxMs) - 7 },
            ]}
          >
            {formatAxisDuration(tick)}
          </Text>
        ))}
      </View>

      <View style={styles.plotArea} onLayout={handleLayout}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={metrics.scrollable}
          bounces={false}
          style={styles.scroll}
          contentContainerStyle={{ width: metrics.contentWidth }}
        >
          <View
            style={{
              width: metrics.contentWidth,
              height: metrics.height,
            }}
          >
            <Svg
              width={metrics.contentWidth}
              height={metrics.baselineY}
              pointerEvents="none"
              style={styles.grid}
            >
              {frame.yTicks.map((tick) =>
                tick > 0 ? (
                  <Line
                    key={tick}
                    x1={0}
                    y1={valueY(metrics, tick, frame.yMaxMs)}
                    x2={metrics.contentWidth}
                    y2={valueY(metrics, tick, frame.yMaxMs)}
                    stroke={colors.border}
                    strokeWidth={1}
                  />
                ) : null,
              )}
              <Line
                x1={0}
                y1={metrics.baselineY}
                x2={metrics.contentWidth}
                y2={metrics.baselineY}
                stroke={colors.axis}
                strokeWidth={1}
              />
            </Svg>

            {children(frame)}
            {overlay?.(frame)}

            {frame.xTicks.map((tick) => {
              const labelWidth = Math.min(
                Math.max(metrics.slotWidth, 30),
                58,
              );
              const center = bucketCenterX(metrics, tick.index);
              const left = Math.max(
                0,
                Math.min(
                  metrics.contentWidth - labelWidth,
                  center - labelWidth / 2,
                ),
              );

              return (
                <Text
                  key={`${tick.index}-${tick.label}`}
                  numberOfLines={1}
                  style={[
                    styles.xLabel,
                    {
                      left,
                      width: labelWidth,
                      top: metrics.baselineY + 6,
                    },
                  ]}
                >
                  {tick.label}
                </Text>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    width: '100%',
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    position: 'relative',
  },
  yLabel: {
    position: 'absolute',
    right: 7,
    height: 14,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    color: colors.muted,
  },
  plotArea: {
    flex: 1,
    height: '100%',
  },
  scroll: {
    flexGrow: 0,
  },
  grid: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    color: colors.muted,
  },
});
