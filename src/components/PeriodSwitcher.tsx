import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import {
  currentPeriodStart,
  formatMonthTitle,
  formatRangeLabel,
  periodDisplayRange,
  periodStartFor,
  shiftPlanningSelection,
  type RangePresetId,
  type RangeSelection,
} from '../utils/dateRange';
import { PeriodPickerSheet } from './PeriodPickerSheet';

interface PeriodSwitcherProps {
  kind: RangePresetId;
  selection: RangeSelection;
  now: number;
  onChange: (selection: RangeSelection) => void;
  futurePeriods?: number;
}

export function PeriodSwitcher({
  kind,
  selection,
  now,
  onChange,
  futurePeriods = 0,
}: PeriodSwitcherProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const start =
    periodStartFor(selection, now) ?? currentPeriodStart(kind, now);
  const displayRange = periodDisplayRange(selection, now);
  const label =
    kind === 'week' && displayRange
      ? formatRangeLabel(displayRange)
      : formatMonthTitle(start);

  const previous = shiftPlanningSelection(
    selection,
    -1,
    now,
    futurePeriods,
  );
  const next = shiftPlanningSelection(
    selection,
    1,
    now,
    futurePeriods,
  );

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kind === 'week' ? '上一周' : '上一个月'}
        accessibilityState={{ disabled: previous === null }}
        disabled={previous === null}
        onPress={() => {
          if (previous) onChange(previous);
        }}
        style={({ pressed }) => [
          styles.arrow,
          previous === null && styles.arrowDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kind === 'week' ? '选择周' : '选择月份'}
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [
          styles.center,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.hint}>
          {kind === 'week' ? '点此选择周' : '点此选择月份'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kind === 'week' ? '下一周' : '下一个月'}
        accessibilityState={{ disabled: next === null }}
        disabled={next === null}
        onPress={() => {
          if (next) onChange(next);
        }}
        style={({ pressed }) => [
          styles.arrow,
          next === null && styles.arrowDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.arrowText}>›</Text>
      </Pressable>

      <PeriodPickerSheet
        visible={pickerOpen}
        mode={kind}
        initialStart={start}
        now={now}
        futurePeriods={futurePeriods}
        onClose={() => setPickerOpen(false)}
        onApply={(nextSelection) => {
          onChange(nextSelection);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.25,
  },
  arrowText: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  hint: {
    marginTop: 1,
    fontSize: 9,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.7,
  },
});
