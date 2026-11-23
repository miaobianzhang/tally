import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeColors } from '../theme/types';
import type { CategoryGroup, TrendBucket } from '../utils/analytics';
import { formatDuration } from '../utils/time';
import { StackedBarChart } from './StackedBarChart';

interface WeeklyDailyBarCardProps {
  buckets: TrendBucket[];
  maxMs: number;
  categories: CategoryGroup[];
}

export function WeeklyDailyBarCard({
  buckets,
  maxMs,
  categories,
}: WeeklyDailyBarCardProps) {
  const styles = useThemedStyles(createStyles);
  const totalMs = buckets.reduce(
    (sum, bucket) => sum + bucket.totalMs,
    0,
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>一周每日分布</Text>
      <Text style={styles.hint}>按天 · 按分类堆叠</Text>
      <View style={styles.chart}>
        <StackedBarChart
          buckets={buckets}
          maxMs={maxMs}
          fitContent
        />
      </View>
      {categories.length > 0 ? (
        <View style={styles.legend}>
          {categories.map((category) => (
            <View key={category.id} style={styles.swatch}>
              <View
                style={[
                  styles.swatchDot,
                  { backgroundColor: category.color },
                ]}
              />
              <Text style={styles.swatchText}>{category.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`一周每日时间分布，按分类堆叠，总计 ${formatDuration(totalMs)}。`}
        style={styles.a11y}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      gap: spacing.md,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    swatch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    swatchDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    swatchText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    a11y: {
      position: 'absolute',
      width: 0,
      height: 0,
    },
  });
