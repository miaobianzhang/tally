import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { colors, radius, spacing } from '../theme';
import type { TrendBucket } from '../utils/analytics';
import type { Granularity } from '../utils/dateRange';
import { TrendLineChart } from './TrendLineChart';

interface EffectiveTimeTrendCardProps {
  buckets: TrendBucket[];
  maxMs: number;
  granularity: Granularity;
}

export function EffectiveTimeTrendCard({
  buckets,
  maxMs,
  granularity,
}: EffectiveTimeTrendCardProps) {
  const hint = `${
    granularity === 'week' ? '每周' : '每天'
  }学习+工作 与 全部活动；黑字为学习+工作，灰字为全部活动${
    buckets.length > 14 ? '；长区间仅标注采样点' : ''
  }`;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>有效时间趋势</Text>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.chart}>
        <TrendLineChart buckets={buckets} maxMs={maxMs} />
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.studyWorkKey} />
          <Text style={styles.legendText}>学习 + 工作</Text>
        </View>
        <View style={styles.legendItem}>
          <Svg width={16} height={6}>
            <Line
              x1={0}
              y1={3}
              x2={16}
              y2={3}
              stroke={colors.textSecondary}
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.legendText}>全部活动（虚线）</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  chart: {
    marginTop: spacing.md,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studyWorkKey: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
