import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import {
  addDays,
  buildWeeksForMonth,
  currentMonthSelection,
  currentPeriodStart,
  currentWeekSelection,
  formatMonthTitle,
  formatRangeLabel,
  minCustomDay,
  shiftMonth,
  startOfMonth,
  startOfWeekMonday,
  type RangeSelection,
} from '../utils/dateRange';
import { hapticSelection } from '../utils/haptics';

interface PeriodPickerSheetProps {
  visible: boolean;
  mode: 'week' | 'month';
  initialStart: number;
  now: number;
  futurePeriods?: number;
  onClose: () => void;
  onApply: (selection: RangeSelection) => void;
}

export function PeriodPickerSheet({
  visible,
  mode,
  initialStart,
  now,
  futurePeriods = 0,
  onClose,
  onApply,
}: PeriodPickerSheetProps) {
  if (!visible) return null;

  return (
    <PeriodPickerContent
      key={`${mode}-${initialStart}`}
      mode={mode}
      initialStart={initialStart}
      now={now}
      futurePeriods={futurePeriods}
      onClose={onClose}
      onApply={onApply}
    />
  );
}

type PeriodPickerContentProps = Omit<PeriodPickerSheetProps, 'visible'>;

function PeriodPickerContent({
  mode,
  initialStart,
  now,
  futurePeriods = 0,
  onClose,
  onApply,
}: PeriodPickerContentProps) {
  const insets = useSafeAreaInsets();
  const currentStart = currentPeriodStart(mode, now);
  const floor =
    mode === 'week'
      ? startOfWeekMonday(minCustomDay(now))
      : startOfMonth(minCustomDay(now));
  const future = Math.max(0, Math.floor(futurePeriods));
  const latest =
    mode === 'week'
      ? addDays(currentStart, future * 7)
      : shiftMonth(currentStart, future);

  const normalizedInitial =
    mode === 'week'
      ? startOfWeekMonday(initialStart)
      : startOfMonth(initialStart);
  const initial = Math.max(floor, Math.min(latest, normalizedInitial));

  const [selectedWeek, setSelectedWeek] = useState(initial);
  const [selectedMonth, setSelectedMonth] = useState(initial);
  const [viewMonth, setViewMonth] = useState(startOfMonth(initial));
  const [viewYear, setViewYear] = useState(new Date(initial).getFullYear());

  const handleApply = () => {
    if (mode === 'week') {
      onApply(
        selectedWeek === currentStart
          ? { kind: 'preset', preset: 'week' }
          : { kind: 'week', weekStart: selectedWeek },
      );
      return;
    }

    onApply(
      selectedMonth === currentStart
        ? { kind: 'preset', preset: 'month' }
        : { kind: 'month', monthStart: selectedMonth },
    );
  };

  const jumpToCurrent = () => {
    hapticSelection();
    onApply(
      mode === 'week'
        ? currentWeekSelection()
        : currentMonthSelection(),
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.flex}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭周期选择"
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.xl) },
          ]}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {mode === 'week' ? '选择周' : '选择月份'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'week' ? '回到本周' : '回到本月'
                }
                onPress={jumpToCurrent}
                style={({ pressed }) => [
                  styles.jumpButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.jumpText}>
                  {mode === 'week' ? '本周' : '本月'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              {mode === 'week'
                ? '按周一至周日选择任意一周'
                : '选择任意一个自然月'}
            </Text>

            {mode === 'week' ? (
              <>
                <View style={styles.navHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="上一个月"
                    disabled={
                      viewMonth <= startOfMonth(floor)
                    }
                    onPress={() =>
                      setViewMonth(shiftMonth(viewMonth, -1))
                    }
                    style={({ pressed }) => [
                      styles.navButton,
                      viewMonth <= startOfMonth(floor) &&
                        styles.navButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.navButtonText}>‹</Text>
                  </Pressable>

                  <Text style={styles.navTitle}>
                    {formatMonthTitle(viewMonth)}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="下一个月"
                    disabled={
                      startOfMonth(viewMonth) >= startOfMonth(latest)
                    }
                    onPress={() =>
                      setViewMonth(shiftMonth(viewMonth, 1))
                    }
                    style={({ pressed }) => [
                      styles.navButton,
                      startOfMonth(viewMonth) >=
                        startOfMonth(latest) &&
                        styles.navButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.navButtonText}>›</Text>
                  </Pressable>
                </View>

                <View style={styles.weekList}>
                  {buildWeeksForMonth(
                    new Date(viewMonth).getFullYear(),
                    new Date(viewMonth).getMonth(),
                  ).map((week) => {
                    const disabled =
                      week.start > latest || week.start < floor;
                    const selected = week.start === selectedWeek;
                    const current = week.start === currentStart;

                    return (
                      <Pressable
                        key={week.start}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        accessibilityLabel={`${formatRangeLabel(week)}${current ? '，本周' : ''}`}
                        disabled={disabled}
                        onPress={() => setSelectedWeek(week.start)}
                        style={({ pressed }) => [
                          styles.weekRow,
                          selected && styles.periodSelected,
                          pressed && !disabled && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.weekText,
                            disabled && styles.disabledText,
                            selected && styles.selectedText,
                          ]}
                        >
                          {formatRangeLabel(week)}
                        </Text>
                        {current ? (
                          <Text
                            style={[
                              styles.nowTag,
                              selected && styles.nowTagSelected,
                            ]}
                          >
                            本周
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={styles.navHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="上一年"
                    disabled={viewYear <= new Date(floor).getFullYear()}
                    onPress={() => setViewYear((year) => year - 1)}
                    style={({ pressed }) => [
                      styles.navButton,
                      viewYear <= new Date(floor).getFullYear() &&
                        styles.navButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.navButtonText}>‹</Text>
                  </Pressable>

                  <Text style={styles.navTitle}>{viewYear}年</Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="下一年"
                    disabled={
                      viewYear >= new Date(latest).getFullYear()
                    }
                    onPress={() => setViewYear((year) => year + 1)}
                    style={({ pressed }) => [
                      styles.navButton,
                      viewYear >=
                        new Date(latest).getFullYear() &&
                        styles.navButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.navButtonText}>›</Text>
                  </Pressable>
                </View>

                <View style={styles.monthGrid}>
                  {Array.from({ length: 12 }, (_, month) => {
                    const start = new Date(viewYear, month, 1).getTime();
                    const disabled = start < floor || start > latest;
                    const selected = start === selectedMonth;
                    const current = start === currentStart;

                    return (
                      <Pressable
                        key={start}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        accessibilityLabel={`${viewYear}年${month + 1}月${current ? '，本月' : ''}`}
                        disabled={disabled}
                        onPress={() => setSelectedMonth(start)}
                        style={({ pressed }) => [
                          styles.monthCell,
                          selected && styles.periodSelected,
                          pressed && !disabled && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthText,
                            disabled && styles.disabledText,
                            selected && styles.selectedText,
                          ]}
                        >
                          {month + 1}月
                        </Text>
                        {current ? (
                          <Text
                            style={[
                              styles.nowTag,
                              selected && styles.nowTagSelected,
                            ]}
                          >
                            本月
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="取消"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'week' ? '查看所选周' : '查看所选月份'
                }
                onPress={handleApply}
                style={({ pressed }) => [
                  styles.apply,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.applyText}>查看</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.text,
  },
  jumpButton: {
    height: 32,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.25,
  },
  navButtonText: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.textSecondary,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  weekList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  weekText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  nowTag: {
    fontSize: 10,
    color: colors.muted,
  },
  nowTagSelected: {
    color: colors.onAccent,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '33.3333%',
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  monthText: {
    fontSize: 14,
    color: colors.text,
  },
  periodSelected: {
    backgroundColor: colors.accent,
  },
  selectedText: {
    fontWeight: '600',
    color: colors.onAccent,
  },
  disabledText: {
    color: colors.muted,
    opacity: 0.4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancel: {
    height: 52,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  apply: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
});
