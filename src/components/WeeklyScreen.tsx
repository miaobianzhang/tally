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
  buildTrendAnalysis,
} from '../utils/analytics';
import {
  buildBuckets,
  formatRangeLabel,
  isCurrentPeriodSelection,
  resolveSelection,
  type RangeSelection,
} from '../utils/dateRange';
import { computePercentages, dayStart } from '../utils/time';
import { buildTimelineDays } from '../utils/timeline';
import { CategoryDistributionCard } from './CategoryDistributionCard';
import { EffectiveTimeTrendCard } from './EffectiveTimeTrendCard';
import { OverviewStats } from './OverviewStats';
import { PeriodSwitcher } from './PeriodSwitcher';
import { TimelineBoard } from './TimelineBoard';

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/analysis');
  }
}

export function WeeklyScreen() {
  const { hydrated, sessions, timer } = useTally();
  const now = useDayKey();
  const [selection, setSelection] = useState<RangeSelection>({
    kind: 'preset',
    preset: 'week',
  });

  const nowDay = dayStart(now);
  const range = useMemo(
    () => resolveSelection(selection, nowDay),
    [selection, nowDay],
  );
  const buckets = useMemo(() => buildBuckets(range), [range]);
  const trend = useMemo(
    () => buildTrendAnalysis(sessions, range, buckets),
    [sessions, range, buckets],
  );
  const breakdown = useMemo(
    () => buildBreakdown(sessions, range),
    [sessions, range],
  );
  const maxMs = useMemo(
    () =>
      trend.buckets.reduce(
        (max, bucket) => Math.max(max, bucket.totalMs),
        0,
      ),
    [trend.buckets],
  );
  const days = useMemo(
    () => buildTimelineDays(sessions, range),
    [sessions, range],
  );

  const isRunning = timer.status === 'running';
  const hasData = trend.totalMs > 0;
  const currentPeriod = isCurrentPeriodSelection(selection, nowDay);
  const granularity = buckets[0]?.granularity ?? 'day';
  const studyWorkPercent =
    trend.totalMs > 0
      ? computePercentages([
          trend.studyWorkMs,
          trend.totalMs - trend.studyWorkMs,
        ])[0]
      : 0;

  if (!hydrated) {
    return (
      <SafeAreaView
        style={styles.safe}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>加载中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回分析"
            onPress={goBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>周分析</Text>
          <View style={styles.headerSpacer} />
        </View>

        <PeriodSwitcher
          kind="week"
          selection={selection}
          now={nowDay}
          onChange={(next) => setSelection(next)}
        />

        <View style={styles.rangeHeader}>
          <Text style={styles.rangeLabel}>{formatRangeLabel(range)}</Text>
          <Text style={styles.rangeMeta}>
            {currentPeriod ? '本周至今' : '完整一周'} ·{' '}
            {granularity === 'week' ? '按周汇总' : '按天'}
          </Text>
        </View>

        {isRunning ? (
          <View style={styles.note}>
            <View style={styles.noteDot} />
            <Text style={styles.noteText}>
              计时中的时段将在结束后计入
            </Text>
          </View>
        ) : null}

        {!hasData ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>这一周还没有记录</Text>
            <Text style={styles.emptyText}>
              换个周查看，或从计时页开始记录。
            </Text>
          </View>
        ) : (
          <>
            <OverviewStats
              title="本周统计"
              totalMs={trend.totalMs}
              studyWorkMs={trend.studyWorkMs}
              studyWorkPercent={studyWorkPercent}
              days={trend.days}
              dailyAverageMs={trend.dailyAverageMs}
            />

            <CategoryDistributionCard
              categories={breakdown.categories}
              totalMs={breakdown.totalMs}
            />

            <EffectiveTimeTrendCard
              buckets={trend.buckets}
              maxMs={maxMs}
              granularity={granularity}
            />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>一周时间轴</Text>
              <Text style={styles.cardHint}>
                按天分行 · 点击色块查看活动明细
              </Text>
              <View style={styles.timeline}>
                <TimelineBoard
                  key={range.start}
                  days={days}
                  variant="week"
                  now={now}
                />
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  rangeHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rangeLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rangeMeta: {
    fontSize: 12,
    color: colors.muted,
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
  emptyCard: {
    paddingVertical: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.muted,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  cardHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
  },
  timeline: {
    marginTop: spacing.md,
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
  pressed: {
    opacity: 0.7,
  },
});
