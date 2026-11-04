import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { CategoryGroup } from '../utils/analytics';
import { ActivityLegend } from './ActivityLegend';
import { CategoryPieChart } from './CategoryPieChart';

interface CategoryDistributionCardProps {
  categories: CategoryGroup[];
  totalMs: number;
}

export function CategoryDistributionCard({
  categories,
  totalMs,
}: CategoryDistributionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>分类分布</Text>
      <Text style={styles.hint}>
        按所选区间统计 · 大块在环内直接标注分类
      </Text>
      <View style={styles.pie}>
        <CategoryPieChart categories={categories} totalMs={totalMs} />
      </View>
      <View style={styles.legend}>
        <ActivityLegend categories={categories} showActivities={false} />
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
  pie: {
    marginTop: spacing.sm,
  },
  legend: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
