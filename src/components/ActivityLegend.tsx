import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { CategoryGroup } from '../utils/analytics';
import { formatDuration, formatPercent } from '../utils/time';

interface ActivityLegendProps {
  categories: CategoryGroup[];
  /** Set false for category-only summaries such as the trend pie. */
  showActivities?: boolean;
  selectedActivityKey?: string | null;
  onSelectActivity?: (key: string) => void;
}

export function ActivityLegend({
  categories,
  showActivities = true,
  selectedActivityKey = null,
  onSelectActivity,
}: ActivityLegendProps) {
  if (categories.length === 0) return null;

  return (
    <View>
      {categories.map((category, categoryIndex) => (
        <View
          key={category.id}
          style={categoryIndex > 0 ? styles.groupSpacing : undefined}
        >
          <View
            accessible
            accessibilityLabel={`${category.label} ${formatDuration(category.ms)}，占 ${formatPercent(category.percentage, category.ms)}`}
            style={styles.categoryRow}
          >
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: category.color },
              ]}
            />
            <Text style={styles.categoryName} numberOfLines={1}>
              {category.label}
            </Text>
            <Text style={styles.value}>
              {formatDuration(category.ms)}
            </Text>
            <Text style={styles.percent}>
              {formatPercent(category.percentage, category.ms)}
            </Text>
          </View>

          {showActivities
            ? category.activities.map((activity) => {
                const selected =
                  selectedActivityKey === activity.key;
                const row = (
                  <>
                    <View
                      style={[
                        styles.activityDot,
                        { backgroundColor: activity.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.activityName,
                        selected && styles.selectedName,
                      ]}
                      numberOfLines={1}
                    >
                      {activity.label}
                    </Text>
                    <Text
                      style={[
                        styles.value,
                        selected && styles.selectedText,
                      ]}
                    >
                      {formatDuration(activity.ms)}
                    </Text>
                    <Text
                      style={[
                        styles.percent,
                        selected && styles.selectedText,
                      ]}
                    >
                      {formatPercent(activity.percentage, activity.ms)}
                    </Text>
                  </>
                );
                const label = `${activity.label}，${category.label}，${formatDuration(activity.ms)}，占总计 ${formatPercent(activity.percentage, activity.ms)}`;

                if (onSelectActivity) {
                  return (
                    <Pressable
                      key={activity.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${label}${selected ? '，已选中，再点一次取消' : '，点击在饼图中高亮'}`}
                      onPress={() => onSelectActivity(activity.key)}
                      style={({ pressed }) => [
                        styles.activityRow,
                        selected && styles.activityRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      {row}
                    </Pressable>
                  );
                }

                return (
                  <View
                    key={activity.key}
                    accessible
                    accessibilityLabel={label}
                    style={styles.activityRow}
                  >
                    {row}
                  </View>
                );
              })
            : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupSpacing: {
    marginTop: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    gap: spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    paddingLeft: 16,
    gap: 6,
  },
  activityRowSelected: {
    backgroundColor: colors.rangeTint,
    borderRadius: radius.sm,
  },
  selectedName: {
    fontWeight: '600',
    color: colors.text,
  },
  selectedText: {
    color: colors.text,
  },
  activityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.9,
  },
  activityName: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  value: {
    width: 74,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    color: colors.textSecondary,
  },
  percent: {
    width: 42,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    color: colors.muted,
  },
  pressed: {
    opacity: 0.75,
  },
});
