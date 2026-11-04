import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PLAN_FUTURE_PERIODS,
  SECTION_VISIBILITY_KEYS,
} from '../constants/plans';
import { useDayKey } from '../hooks/useDayKey';
import { usePlans } from '../hooks/usePlans';
import { useTally } from '../hooks/useTally';
import { colors, radius, spacing } from '../theme';
import type { PlanItem, PlanSection } from '../types';
import {
  currentPeriodStart,
  periodStartFor,
  type RangeSelection,
} from '../utils/dateRange';
import { hapticSelection } from '../utils/haptics';
import {
  planProgress,
  plansForPeriod,
  sortPlansForSection,
} from '../utils/plans';
import { PeriodSwitcher } from './PeriodSwitcher';
import { PlanItemRow } from './PlanItemRow';
import { PlanItemSheet } from './PlanItemSheet';
import {
  PlanLaunchOverlay,
  type LaunchOrigin,
} from './PlanLaunchOverlay';
import { PlanSettingsSheet } from './PlanSettingsSheet';

interface SheetState {
  section: PlanSection;
  plan: PlanItem | null;
  periodStart: number | null;
}

interface LaunchState {
  plan: PlanItem;
  origin: LaunchOrigin;
  started: boolean;
}

export function PlanScreen() {
  const {
    hydrated: plansHydrated,
    busy: plansBusy,
    items,
    prefs,
  } = usePlans();
  const {
    hydrated: tallyHydrated,
    busy: tallyBusy,
    timer,
    lastCategory,
    start,
  } = useTally();
  const now = useDayKey();

  const [weekSelection, setWeekSelection] = useState<RangeSelection>({
    kind: 'preset',
    preset: 'week',
  });
  const [monthSelection, setMonthSelection] = useState<RangeSelection>({
    kind: 'preset',
    preset: 'month',
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [launch, setLaunch] = useState<LaunchState | null>(null);
  const launchingRef = useRef(false);
  const navigatedRef = useRef(false);

  const weekStart =
    periodStartFor(weekSelection, now) ??
    currentPeriodStart('week', now);
  const monthStart =
    periodStartFor(monthSelection, now) ??
    currentPeriodStart('month', now);

  const weekItems = useMemo(
    () =>
      sortPlansForSection(
        plansForPeriod(items, 'week', weekStart),
        'week',
      ),
    [items, weekStart],
  );
  const monthItems = useMemo(
    () =>
      sortPlansForSection(
        plansForPeriod(items, 'month', monthStart),
        'month',
      ),
    [items, monthStart],
  );
  const deadlineItems = useMemo(
    () =>
      sortPlansForSection(
        items.filter((item) => item.section === 'deadline'),
        'deadline',
      ),
    [items],
  );

  const weekProgress = planProgress(weekItems);
  const monthProgress = planProgress(monthItems);
  const deadlineProgress = planProgress(deadlineItems);
  const visibleSections = prefs.sectionOrder.filter(
    (section) => prefs[SECTION_VISIBILITY_KEYS[section]],
  ).length;

  const startPlan = (plan: PlanItem, origin: LaunchOrigin) => {
    if (launchingRef.current) return;

    if (timer.status !== 'idle') {
      Alert.alert(
        '正在计时',
        '请先结束并保存当前计时，再开始新的计时。',
      );
      return;
    }
    if (tallyBusy) return;

    launchingRef.current = true;
    navigatedRef.current = false;
    hapticSelection();
    setLaunch({ plan, origin, started: false });

    void (async () => {
      const started = await start({
        planId: plan.id,
        activity: plan.title,
        category: plan.category,
      });
      if (!started) {
        launchingRef.current = false;
        setLaunch(null);
        return;
      }
      setLaunch((current) =>
        current ? { ...current, started: true } : current,
      );
    })();
  };

  const handleLaunchNavigate = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.navigate('/');
  }, []);

  const handleLaunchDone = useCallback(() => {
    launchingRef.current = false;
    navigatedRef.current = false;
    setLaunch(null);
  }, []);

  const openAdd = (section: PlanSection, periodStart: number | null) => {
    setSheet({ section, plan: null, periodStart });
  };

  const openEdit = (plan: PlanItem) => {
    setSheet({
      section: plan.section,
      plan,
      periodStart: plan.periodStart,
    });
  };

  const renderRows = (rows: PlanItem[], emptyText: string) => {
    if (rows.length === 0) {
      return <Text style={styles.emptyText}>{emptyText}</Text>;
    }

    return rows.map((plan) => (
      <PlanItemRow
        key={plan.id}
        plan={plan}
        now={now}
        busy={plansBusy}
        onStart={startPlan}
        onEdit={openEdit}
      />
    ));
  };

  const renderSectionCard = (section: PlanSection) => {
    if (!prefs[SECTION_VISIBILITY_KEYS[section]]) return null;

    if (section === 'week') {
      return (
        <View key={section} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardTitle}>周计划</Text>
              <Text style={styles.cardMeta}>
                {weekProgress.total > 0
                  ? `${weekProgress.completed}/${weekProgress.total} 已完成`
                  : '这一周从一件小事开始'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="添加周计划"
              onPress={() => openAdd('week', weekStart)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.addText}>+ 添加</Text>
            </Pressable>
          </View>

          <PeriodSwitcher
            kind="week"
            selection={weekSelection}
            now={now}
            onChange={setWeekSelection}
            futurePeriods={PLAN_FUTURE_PERIODS.week}
          />

          <View style={styles.list}>
            {renderRows(weekItems, '这一周还没有计划')}
          </View>
        </View>
      );
    }

    if (section === 'month') {
      return (
        <View key={section} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.cardTitle}>月计划</Text>
              <Text style={styles.cardMeta}>
                {monthProgress.total > 0
                  ? `${monthProgress.completed}/${monthProgress.total} 已完成`
                  : '给这个月留一个方向'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="添加月计划"
              onPress={() => openAdd('month', monthStart)}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.addText}>+ 添加</Text>
            </Pressable>
          </View>

          <PeriodSwitcher
            kind="month"
            selection={monthSelection}
            now={now}
            onChange={setMonthSelection}
            futurePeriods={PLAN_FUTURE_PERIODS.month}
          />

          <View style={styles.list}>
            {renderRows(monthItems, '这个月还没有计划')}
          </View>
        </View>
      );
    }

    return (
      <View key={section} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <Text style={styles.cardTitle}>Deadline</Text>
            <Text style={styles.cardMeta}>
              {deadlineProgress.total > 0
                ? `${deadlineProgress.completed}/${deadlineProgress.total} 已完成`
                : '没有悬着的事'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="添加 Deadline"
            onPress={() => openAdd('deadline', null)}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.addText}>+ 添加</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {renderRows(deadlineItems, '还没有 Deadline')}
        </View>
      </View>
    );
  };

  if (!plansHydrated || !tallyHydrated) {
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
          <View>
            <Text style={styles.title}>计划</Text>
            <Text style={styles.subtitle}>把想做的事放进时间里</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开计划设置"
            onPress={() => setSettingsOpen(true)}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.settingsText}>设置</Text>
          </Pressable>
        </View>

        {visibleSections === 0 ? (
          <View style={styles.allHidden}>
            <Text style={styles.allHiddenTitle}>所有计划区块已隐藏</Text>
            <Text style={styles.allHiddenText}>
              计划仍然保留，打开设置即可重新显示。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="打开计划设置"
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [
                styles.allHiddenButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.allHiddenButtonText}>打开设置</Text>
            </Pressable>
          </View>
        ) : (
          prefs.sectionOrder.map((section) =>
            renderSectionCard(section),
          )
        )}
      </ScrollView>

      {settingsOpen ? (
        <PlanSettingsSheet onClose={() => setSettingsOpen(false)} />
      ) : null}

      {sheet ? (
        <PlanItemSheet
          key={
            sheet.plan?.id ??
            `new-${sheet.section}-${sheet.periodStart ?? 'deadline'}`
          }
          section={sheet.section}
          plan={sheet.plan}
          periodStart={sheet.periodStart}
          defaultCategory={lastCategory}
          now={now}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {launch ? (
        <PlanLaunchOverlay
          plan={launch.plan}
          origin={launch.origin}
          started={launch.started}
          onNavigate={handleLaunchNavigate}
          onDone={handleLaunchDone}
        />
      ) : null}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
  },
  settingsButton: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  card: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.text,
  },
  cardMeta: {
    marginTop: 3,
    fontSize: 11,
    color: colors.muted,
  },
  addButton: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  list: {
    marginTop: spacing.sm,
  },
  emptyText: {
    paddingVertical: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
  },
  allHidden: {
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
  },
  allHiddenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  allHiddenText: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.muted,
  },
  allHiddenButton: {
    marginTop: spacing.xl,
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allHiddenButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.8,
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
