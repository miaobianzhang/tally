import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Path,
  Text as SvgText,
} from 'react-native-svg';

import { colors } from '../theme';
import type { TrendBucket } from '../utils/analytics';
import {
  bucketCenterX,
  computePointLabelYs,
  formatAxisDuration,
  linePath,
  selectPointLabelIndices,
  valueY,
} from '../utils/chart';
import { formatDuration } from '../utils/time';
import { ChartFrame } from './ChartFrame';

interface TrendLineChartProps {
  buckets: TrendBucket[];
  maxMs: number;
}

interface PointLabelProps {
  x: number;
  y: number;
  text: string;
  color: string;
  textAnchor: 'start' | 'middle' | 'end';
}

function PointLabel({ x, y, text, color, textAnchor }: PointLabelProps) {
  return (
    <>
      <SvgText
        x={x}
        y={y}
        textAnchor={textAnchor}
        fontSize={9}
        fontWeight="600"
        fill="none"
        stroke={colors.surface}
        strokeWidth={3}
        strokeLinejoin="round"
      >
        {text}
      </SvgText>
      <SvgText
        x={x}
        y={y}
        textAnchor={textAnchor}
        fontSize={9}
        fontWeight="600"
        fill={color}
      >
        {text}
      </SvgText>
    </>
  );
}

export function TrendLineChart({ buckets, maxMs }: TrendLineChartProps) {
  const totalMs = buckets.reduce((sum, bucket) => sum + bucket.totalMs, 0);
  const studyWorkMs = buckets.reduce(
    (sum, bucket) => sum + bucket.studyWorkMs,
    0,
  );
  const showMarkers = buckets.length <= 14;
  const labelIndices = selectPointLabelIndices(buckets.length);

  return (
    <ChartFrame buckets={buckets} maxMs={maxMs}>
      {({ metrics, yMaxMs }) => {
        const totalValues = buckets.map((bucket) => bucket.totalMs);
        const studyWorkValues = buckets.map(
          (bucket) => bucket.studyWorkMs,
        );
        const totalPath = linePath(totalValues, metrics, yMaxMs);
        const studyWorkPath = linePath(studyWorkValues, metrics, yMaxMs);

        return (
          <>
            <Svg
              width={metrics.contentWidth}
              height={metrics.baselineY}
              pointerEvents="none"
              style={styles.marks}
            >
              {totalPath ? (
                <Path
                  d={totalPath}
                  fill="none"
                  stroke={colors.textSecondary}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {studyWorkPath ? (
                <Path
                  d={studyWorkPath}
                  fill="none"
                  stroke={colors.text}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {labelIndices.map((index) => {
                const bucket = buckets[index];
                const x = bucketCenterX(metrics, index);
                const markerRadius = showMarkers ? 4 : 3;
                return (
                  <G key={`markers-${bucket.start}`}>
                    <Circle
                      cx={x}
                      cy={valueY(metrics, bucket.totalMs, yMaxMs)}
                      r={markerRadius}
                      fill={colors.surface}
                      stroke={colors.textSecondary}
                      strokeWidth={2}
                    />
                    <Circle
                      cx={x}
                      cy={valueY(metrics, bucket.studyWorkMs, yMaxMs)}
                      r={markerRadius}
                      fill={colors.text}
                      stroke={colors.surface}
                      strokeWidth={2}
                    />
                  </G>
                );
              })}

              {labelIndices.map((index) => {
                const bucket = buckets[index];
                const x = bucketCenterX(metrics, index);
                const studyY = valueY(metrics, bucket.studyWorkMs, yMaxMs);
                const totalY = valueY(metrics, bucket.totalMs, yMaxMs);
                const labelYs = computePointLabelYs(
                  studyY,
                  totalY,
                  metrics.baselineY,
                );
                const textAnchor: 'start' | 'middle' | 'end' =
                  buckets.length === 1
                    ? 'middle'
                    : index === 0
                      ? 'start'
                      : index === buckets.length - 1
                        ? 'end'
                        : 'middle';

                return (
                  <G key={`labels-${bucket.start}`}>
                    <PointLabel
                      x={x}
                      y={labelYs.studyWork}
                      text={formatAxisDuration(bucket.studyWorkMs)}
                      color={colors.text}
                      textAnchor={textAnchor}
                    />
                    <PointLabel
                      x={x}
                      y={labelYs.total}
                      text={formatAxisDuration(bucket.totalMs)}
                      color={colors.textSecondary}
                      textAnchor={textAnchor}
                    />
                  </G>
                );
              })}
            </Svg>

            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={`有效时间趋势。学习与工作合计 ${formatDuration(studyWorkMs)}，全部活动合计 ${formatDuration(totalMs)}。`}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
          </>
        );
      }}
    </ChartFrame>
  );
}

const styles = StyleSheet.create({
  marks: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
