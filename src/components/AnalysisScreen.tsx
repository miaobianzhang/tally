import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDayKey } from '../hooks/useDayKey';
import { useTally } from '../hooks/useTally';
import { colors, radius, spacing } from '../theme';
import {
  buildBreakdown,
  type Breakdown,
} from '../utils/analytics';
import {
  computePercentages,
  dayStart,
  formatDateLabel,
  formatDuration,
  formatPercent,
  nextDayStart,
} from '../utils/time';
import { hapticSelection } from '../utils/haptics';
import { buildTimelineDays } from '../utils/timeline';
import { ActivityLegend } from './ActivityLegend';
import { DonutChart } from './DonutChart';
import { OverviewStats } from './OverviewStats';
import { VerticalDayTimeline } from './VerticalDayTimeline';

function accessibilitySummary(breakdown: Breakdown): string {
  if (breakdown.categories.length === 0) {
    return '今天还没有时间记录。';
  }

  const categories = breakdown.categories
    .map(
      (category) =>
        `${category.label} ${formatDuration(category.ms)}，占 ${formatPercent(category.percentage, category.ms)}`,
    )
    .join('；');
  const activities = breakdown.activities
    .map(
      (activity) =>
        `${activity.label} ${formatDuration(activity.ms)}，占 ${formatPercent(activity.percentage, activity.ms)}`,
    )
    .join('；');

  return `今日时间分布。分类：${categories}。活动：${activities}。总计 ${formatDuration(breakdown.totalMs)}，学习和工作 ${formatDuration(breakdown.studyWorkMs)}。`;
}

export function AnalysisScreen() {
  const { hydrated, sessions, timer } = useTally();
  const now = useDayKey();
  const rangeStart = dayStart(now);
  const rangeEnd = nextDayStart(now);
  const breakdown = useMemo(
    () => buildBreakdown(sessions, { start: rangeStart, end: rangeEnd }),
    [sessions, rangeStart, rangeEnd],
  );
  const timelineDays = useMemo(
    () =>
      buildTimelineDays(sessions, {
        start: rangeStart,
        end: rangeEnd,
      }),
    [sessions, rangeStart, rangeEnd],
  );
  const [selection, setSelection] = useState<{
    day: number;
    key: string;
  } | null>(null);
  const selectedActivityKey =
    selection &&
    selection.day === rangeStart &&
    breakdown.activities.some(
      (activity) => activity.key === selection.key,
    )
      ? selection.key
      : null;

  const toggleActivity = (key: string) => {
    hapticSelection();
    setSelection((current) =>
      current &&
      current.day === rangeStart &&
      current.key === key
        ? null
        : { day: rangeStart, key },
    );
  };

  const studyWorkPercent =
    breakdown.totalMs > 0
      ? computePercentages([
          breakdown.studyWorkMs,
          breakdown.totalMs - breakdown.studyWorkMs,
        ])[0]
      : 0;
  const isRunning = timer.status === 'running';

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>加载中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>今日分析</Text>
            <Text style={styles.date}>{formatDateLabel(now)}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看周分析"
              onPress={() => router.push('/weekly')}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.headerButtonText}>周分析</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看月分析"
              onPress={() => router.push('/monthly')}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.headerButtonText}>月分析</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看自定义区间分析"
              onPress={() => router.push('/custom')}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.headerButtonText}>自定义</Text>
            </Pressable>
          </View>
        </View>

        {isRunning ? (
          <View style={styles.note}>
            <View style={styles.noteDot} />
            <Text style={styles.noteText}>计时中的时段将在结束后计入</Text>
          </View>
        ) : null}

        {breakdown.categories.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyRing} />
            <Text style={styles.emptyTitle}>今天还没有记录</Text>
            <Text style={styles.emptyText}>
              开始一段专注，晚上来看看时间去了哪里。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="去计时"
              onPress={() => router.navigate('/')}
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emptyButtonText}>去计时</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <OverviewStats
              title="今日统计"
              totalMs={breakdown.totalMs}
              studyWorkMs={breakdown.studyWorkMs}
              studyWorkPercent={studyWorkPercent}
            />

            <View style={styles.chartBlock}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>今天做了什么</Text>
              </View>

              <DonutChart
                categories={breakdown.categories}
                activities={breakdown.activities}
                totalMs={breakdown.totalMs}
                accessibilityLabel={accessibilitySummary(breakdown)}
                showDirectLabels
                selectedActivityKey={selectedActivityKey}
                onSelectActivity={toggleActivity}
              />

              <View style={styles.legend}>
                <ActivityLegend
                  categories={breakdown.categories}
                  selectedActivityKey={selectedActivityKey}
                  onSelectActivity={toggleActivity}
                />
              </View>
            </View>

            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>今日时间轴</Text>
              <VerticalDayTimeline days={timelineDays} now={now} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  headerText: {},
  title: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.text,
  },
  date: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    flex: 1,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.text,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.running,
  },
  noteText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chartBlock: {
    alignItems: 'center',
  },
  chartHeader: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  legend: {
    width: '100%',
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  timelineCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
  },
  emptyRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 12,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.muted,
  },
  emptyButton: {
    marginTop: spacing.xl,
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onAccent,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
});
