import { colors } from '../theme';
import type { CategoryGroup } from '../utils/analytics';
import { formatDuration, formatPercent } from '../utils/time';
import { DonutChart } from './DonutChart';

interface CategoryPieChartProps {
  categories: CategoryGroup[];
  totalMs: number;
}

function categorySummary(
  categories: CategoryGroup[],
  totalMs: number,
): string {
  if (categories.length === 0) return '所选区间没有分类记录。';

  const details = categories
    .map(
      (category) =>
        `${category.label} ${formatDuration(category.ms)}，占 ${formatPercent(category.percentage, category.ms)}`,
    )
    .join('；');

  return `分类时间分布。${details}。总计 ${formatDuration(totalMs)}。`;
}

export function CategoryPieChart({
  categories,
  totalMs,
}: CategoryPieChartProps) {
  if (totalMs <= 0 || categories.length === 0) return null;

  return (
    <DonutChart
      categories={categories}
      activities={[]}
      totalMs={totalMs}
      accessibilityLabel={categorySummary(categories, totalMs)}
      variant="category"
      showDirectLabels
      gapColor={colors.surface}
    />
  );
}
