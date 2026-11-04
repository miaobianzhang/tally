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
  buildMonthGrid,
  formatFullDate,
  formatFullDateWithYear,
  formatMonthTitle,
  minCustomDay,
  shiftMonth,
  startOfMonth,
  type DateRange,
} from '../utils/dateRange';
import { dayStart, nextDayStart } from '../utils/time';

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const;

interface RangePickerSheetProps {
  visible: boolean;
  initialRange: DateRange;
  now: number;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}

export function RangePickerSheet({
  visible,
  initialRange,
  now,
  onClose,
  onApply,
}: RangePickerSheetProps) {
  if (!visible) return null;

  return (
    <RangePickerContent
      key={`${initialRange.start}-${initialRange.end}`}
      initialRange={initialRange}
      now={now}
      onClose={onClose}
      onApply={onApply}
    />
  );
}

type RangePickerContentProps = Omit<RangePickerSheetProps, 'visible'>;

function RangePickerContent({
  initialRange,
  now,
  onClose,
  onApply,
}: RangePickerContentProps) {
  const insets = useSafeAreaInsets();
  const today = dayStart(now);
  const earliest = minCustomDay(now);
  const initialStart = Math.max(dayStart(initialRange.start), earliest);
  const initialEnd = Math.min(
    Math.max(dayStart(addDays(initialRange.end, -1)), initialStart),
    today,
  );

  const [selectedStart, setSelectedStart] = useState(initialStart);
  const [selectedEnd, setSelectedEnd] = useState<number | null>(initialEnd);
  const [viewMonth, setViewMonth] = useState(
    startOfMonth(initialStart),
  );

  const canGoPrevious = viewMonth > startOfMonth(earliest);
  const canGoNext = viewMonth < startOfMonth(today);
  const monthDate = new Date(viewMonth);
  const cells = buildMonthGrid(
    monthDate.getFullYear(),
    monthDate.getMonth(),
  );
  const selectionUsesYear =
    selectedEnd !== null &&
    new Date(selectedStart).getFullYear() !==
      new Date(selectedEnd).getFullYear();
  const formatSelectionDate = (day: number) =>
    selectionUsesYear
      ? formatFullDateWithYear(day)
      : formatFullDate(day);

  const handleDayPress = (day: number) => {
    if (selectedEnd !== null) {
      setSelectedStart(day);
      setSelectedEnd(null);
      return;
    }

    setSelectedStart(Math.min(selectedStart, day));
    setSelectedEnd(Math.max(selectedStart, day));
  };

  const handleApply = () => {
    if (selectedEnd === null) return;
    onApply({
      start: dayStart(selectedStart),
      end: nextDayStart(selectedEnd),
    });
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
          accessibilityLabel="关闭日期选择"
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
            <Text style={styles.title}>自定义区间</Text>
            <Text style={styles.subtitle}>
              先点开始日，再点结束日
            </Text>

            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="上一个月"
                disabled={!canGoPrevious}
                onPress={() =>
                  setViewMonth(shiftMonth(viewMonth, -1))
                }
                style={({ pressed }) => [
                  styles.monthButton,
                  !canGoPrevious && styles.monthButtonDisabled,
                  pressed && canGoPrevious && styles.pressed,
                ]}
              >
                <Text style={styles.monthButtonText}>‹</Text>
              </Pressable>

              <Text style={styles.monthTitle}>
                {formatMonthTitle(viewMonth)}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="下一个月"
                disabled={!canGoNext}
                onPress={() => setViewMonth(shiftMonth(viewMonth, 1))}
                style={({ pressed }) => [
                  styles.monthButton,
                  !canGoNext && styles.monthButtonDisabled,
                  pressed && canGoNext && styles.pressed,
                ]}
              >
                <Text style={styles.monthButtonText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {WEEKDAY_HEADERS.map((label) => (
                <Text key={label} style={styles.weekHeaderText}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (day === null) {
                  return (
                    <View
                      key={`blank-${index}`}
                      style={styles.cell}
                    />
                  );
                }

                const disabled = day > today || day < earliest;
                const isStart = day === selectedStart;
                const isEnd =
                  selectedEnd !== null && day === selectedEnd;
                const isBoundary = isStart || isEnd;
                const isInRange =
                  selectedEnd !== null &&
                  day > selectedStart &&
                  day < selectedEnd;
                const isToday = day === today;

                return (
                  <View key={day} style={styles.cell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={formatFullDateWithYear(day)}
                      accessibilityState={{
                        selected: isBoundary,
                        disabled,
                      }}
                      disabled={disabled}
                      onPress={() => handleDayPress(day)}
                      style={({ pressed }) => [
                        styles.day,
                        isInRange && styles.dayInRange,
                        isToday && !isBoundary && styles.dayToday,
                        isBoundary && styles.daySelected,
                        pressed && !disabled && styles.dayPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          disabled && styles.dayTextDisabled,
                          isBoundary && styles.dayTextSelected,
                        ]}
                      >
                        {new Date(day).getDate()}
                      </Text>
                      {isToday && !isBoundary ? (
                        <View style={styles.todayDot} />
                      ) : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={styles.selection}>
              <View style={styles.selectionDates}>
                <Text style={styles.selectionText}>
                  {formatSelectionDate(selectedStart)}
                </Text>
                <Text style={styles.selectionArrow}>→</Text>
                <Text
                  style={[
                    styles.selectionText,
                    selectedEnd === null && styles.selectionPlaceholder,
                  ]}
                >
                  {selectedEnd === null
                    ? '选择结束日'
                    : formatSelectionDate(selectedEnd)}
                </Text>
              </View>
            </View>

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
                accessibilityLabel="应用区间"
                disabled={selectedEnd === null}
                onPress={handleApply}
                style={({ pressed }) => [
                  styles.apply,
                  selectedEnd === null && styles.applyDisabled,
                  pressed && selectedEnd !== null && styles.pressed,
                ]}
              >
                <Text style={styles.applyText}>确认</Text>
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
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.25,
  },
  monthButtonText: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.textSecondary,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  weekHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  weekHeaderText: {
    width: '14.2857%',
    fontSize: 11,
    textAlign: 'center',
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInRange: {
    backgroundColor: colors.rangeTint,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.axis,
  },
  daySelected: {
    backgroundColor: colors.accent,
  },
  dayPressed: {
    opacity: 0.7,
  },
  dayText: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  dayTextDisabled: {
    color: colors.muted,
    opacity: 0.4,
  },
  dayTextSelected: {
    fontWeight: '600',
    color: colors.onAccent,
  },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
  },
  selection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.page,
  },
  selectionDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  selectionPlaceholder: {
    fontWeight: '400',
    color: colors.muted,
  },
  selectionArrow: {
    fontSize: 14,
    color: colors.muted,
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
  applyDisabled: {
    opacity: 0.35,
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
