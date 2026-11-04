import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { formatDuration, formatPercent } from '../utils/time';

interface OverviewStatsProps {
  title: string;
  totalMs: number;
  studyWorkMs: number;
  studyWorkPercent: number;
  days?: number;
  dailyAverageMs?: number;
  totalLabel?: string;
  studyWorkLabel?: string;
}

export function OverviewStats({
  title,
  totalMs,
  studyWorkMs,
  studyWorkPercent,
  days,
  dailyAverageMs,
  totalLabel = '全部活动',
  studyWorkLabel = '学习 + 工作',
}: OverviewStatsProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.row}>
        <View
          accessible
          accessibilityLabel={`${totalLabel} ${formatDuration(totalMs)}`}
          style={styles.cell}
        >
          <Text style={styles.label}>{totalLabel}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {formatDuration(totalMs)}
          </Text>
        </View>

        <View style={styles.divider} />

        <View
          accessible
          accessibilityLabel={`${studyWorkLabel} ${formatDuration(studyWorkMs)}，占 ${formatPercent(studyWorkPercent, studyWorkMs)}`}
          style={styles.cell}
        >
          <Text style={styles.label}>{studyWorkLabel}</Text>
          <Text style={styles.value} numberOfLines={1}>
            {formatDuration(studyWorkMs)}
          </Text>
          <Text style={styles.meta}>
            占 {formatPercent(studyWorkPercent, studyWorkMs)}
          </Text>
        </View>
      </View>

      {days !== undefined && dailyAverageMs !== undefined ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            按 {days} 天 · 日均 {formatDuration(dailyAverageMs)}
          </Text>
        </View>
      ) : null}
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.md,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
  },
  value: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  meta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 11,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
});
