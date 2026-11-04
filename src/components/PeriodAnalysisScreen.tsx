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

import { CATEGORIES } from '../constants/categories';
import { useDayKey } from '../hooks/useDayKey';
import { useTally } from '../hooks/useTally';
import { colors, radius, spacing } from '../theme';
import {
  buildBreakdown,
  buildTrendAnalysis,
  type TrendBucket,
} from '../utils/analytics';
import {
  addDays,
  buildBuckets,
  formatRangeLabel,
  isCurrentPeriodSelection,
  resolveSelection,
  type RangeSelection,
} from '../utils/dateRange';
import {
  computePercentages,
  dayStart,
  nextDayStart,
} from '../utils/time';
import { BucketDetailSheet } from './BucketDetailSheet';
import { CategoryDistributionCard } from './CategoryDistributionCard';
import { EffectiveTimeTrendCard } from './EffectiveTimeTrendCard';
import { OverviewStats } from './OverviewStats';
import { PeriodSwitcher } from './PeriodSwitcher';
import { RangePickerSheet } from './RangePickerSheet';
import { StackedBarChart } from './StackedBarChart';

export type PeriodAnalysisMode = 'month' | 'custom';

interface PeriodAnalysisScreenProps {
  mode: PeriodAnalysisMode;
}

function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/analysis');
  }
}

function initialSelection(
  mode: PeriodAnalysisMode,
  nowDay: number,
): RangeSelection {
  if (mode === 'month') {
    return { kind: 'preset', preset: 'month' };
  }

  return {
    kind: 'custom',
    range: {
      start: addDays(nowDay, -6),
      end: nextDayStart(nowDay),
    },
  };
}

export function PeriodAnalysisScreen({
  mode,
}: PeriodAnalysisScreenProps) {
  const { hydrated, sessions, timer } = useTally();
  const now = useDayKey();
  const [selection, setSelection] = useState<RangeSelection>(() =>
    initialSelection(mode, dayStart(now)),
  );
  const [selectedBucket, setSelectedBucket] =
    useState<TrendBucket | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const isRunning = timer.status === 'running';
  const hasData = trend.totalMs > 0 && buckets.length > 0;
  const granularity = buckets[0]?.granularity ?? 'day';
  const currentPeriod = isCurrentPeriodSelection(selection, nowDay);
  const studyWorkPercent =
    trend.totalMs > 0
      ? computePercentages([
          trend.studyWorkMs,
          trend.totalMs - trend.studyWorkMs,
        ])[0]
      : 0;
  const bucketSummary = granularity === 'week' ? '按周汇总' : '按天';
  const rangeMeta =
    mode === 'month'
      ? `${currentPeriod ? '本月至今' : '完整一月'} · ${bucketSummary}`
      : bucketSummary;

  const presentCategories = CATEGORIES.map((category, index) => ({
    ...category,
    ms: trend.buckets.reduce(
      (sum, bucket) => sum + bucket.categoryMs[index],
      0,
    ),
  })).filter((category) => category.ms > 0);

  const handleSelection = (next: RangeSelection) => {
    setSelectedBucket(null);
    setSelection(next);
  };

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
          <Text style={styles.headerTitle}>
            {mode === 'month' ? '月分析' : '自定义分析'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.periodControl}>
          {mode === 'month' ? (
            <PeriodSwitcher
              kind="month"
              selection={selection}
              now={nowDay}
              onChange={handleSelection}
            />
          ) : (
            <View style={styles.customRange}>
              <Text style={styles.customRangeText} numberOfLines={1}>
                {formatRangeLabel(range)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="编辑自定义区间"
                onPress={() => setPickerOpen(true)}
                style={({ pressed }) => [
                  styles.editButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.editButtonText}>编辑</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.rangeHeader}>
          <Text style={styles.rangeLabel}>{formatRangeLabel(range)}</Text>
          <Text style={styles.rangeMeta}>{rangeMeta}</Text>
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
            <Text style={styles.emptyTitle}>这个区间还没有记录</Text>
            <Text style={styles.emptyText}>
              换个区间，或从计时页开始记录。
            </Text>
          </View>
        ) : (
          <>
            <OverviewStats
              title="区间概览"
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

            <View style={styles.card}>
              <Text style={styles.cardTitle}>时间分布</Text>
              <Text style={styles.cardHint}>
                按分类堆叠 · 点击柱子查看活动明细
              </Text>
              <View style={styles.chart}>
                <StackedBarChart
                  buckets={trend.buckets}
                  maxMs={maxMs}
                  onSelectBucket={setSelectedBucket}
                />
              </View>
              <View style={styles.swatches}>
                {presentCategories.map((category) => (
                  <View key={category.id} style={styles.swatch}>
                    <View
                      style={[
                        styles.swatchDot,
                        { backgroundColor: category.color },
                      ]}
                    />
                    <Text style={styles.swatchText}>
                      {category.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <EffectiveTimeTrendCard
              buckets={trend.buckets}
              maxMs={maxMs}
              granularity={granularity}
            />
          </>
        )}
      </ScrollView>

      {mode === 'custom' ? (
        <RangePickerSheet
          visible={pickerOpen}
          initialRange={range}
          now={now}
          onClose={() => setPickerOpen(false)}
          onApply={(customRange) => {
            handleSelection({ kind: 'custom', range: customRange });
            setPickerOpen(false);
          }}
        />
      ) : null}

      <BucketDetailSheet
        bucket={selectedBucket}
        sessions={sessions}
        onClose={() => setSelectedBucket(null)}
      />
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
  periodControl: {
    marginBottom: spacing.sm,
  },
  customRange: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  customRangeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  editButton: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.rangeTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  chart: {
    marginTop: spacing.md,
  },
  swatches: {
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
    gap: 6,
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
