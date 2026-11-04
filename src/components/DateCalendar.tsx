import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import {
  buildMonthGrid,
  formatFullDateWithYear,
  formatMonthTitle,
  isSameDay,
  shiftMonth,
  startOfMonth,
} from '../utils/dateRange';
import { hapticSelection } from '../utils/haptics';
import { dayStart } from '../utils/time';

interface DateCalendarProps {
  value: number;
  onChange: (value: number) => void;
  now: number;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function DateCalendar({
  value,
  onChange,
  now,
}: DateCalendarProps) {
  const today = dayStart(now);
  const todayDate = new Date(today);
  const floor = new Date(
    todayDate.getFullYear() - 5,
    todayDate.getMonth(),
    todayDate.getDate(),
  ).getTime();
  const ceiling = new Date(
    todayDate.getFullYear() + 5,
    todayDate.getMonth(),
    todayDate.getDate(),
  ).getTime();

  const normalizedValue = Math.max(floor, Math.min(ceiling, value));
  const [viewMonth, setViewMonth] = useState(
    startOfMonth(normalizedValue),
  );
  const year = new Date(viewMonth).getFullYear();
  const month = new Date(viewMonth).getMonth();
  const cells = buildMonthGrid(year, month);
  const previousDisabled =
    startOfMonth(viewMonth) <= startOfMonth(floor);
  const nextDisabled =
    startOfMonth(viewMonth) >= startOfMonth(ceiling);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上一个月"
          accessibilityState={{ disabled: previousDisabled }}
          disabled={previousDisabled}
          onPress={() => setViewMonth(shiftMonth(viewMonth, -1))}
          style={({ pressed }) => [
            styles.navButton,
            previousDisabled && styles.navDisabled,
            pressed && !previousDisabled && styles.pressed,
          ]}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>

        <Text style={styles.monthTitle}>{formatMonthTitle(viewMonth)}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下一个月"
          accessibilityState={{ disabled: nextDisabled }}
          disabled={nextDisabled}
          onPress={() => setViewMonth(shiftMonth(viewMonth, 1))}
          style={({ pressed }) => [
            styles.navButton,
            nextDisabled && styles.navDisabled,
            pressed && !nextDisabled && styles.pressed,
          ]}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((timestamp, index) => {
          if (timestamp === null) {
            return <View key={`empty-${index}`} style={styles.cell} />;
          }

          const disabled = timestamp < floor || timestamp > ceiling;
          const selected = isSameDay(timestamp, normalizedValue);
          const isToday = isSameDay(timestamp, today);

          return (
            <Pressable
              key={timestamp}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={formatFullDateWithYear(timestamp)}
              disabled={disabled}
              android_ripple={{ color: 'transparent' }}
              onPress={() => {
                hapticSelection();
                onChange(dayStart(timestamp));
              }}
              style={styles.cell}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.dayCircle,
                    pressed &&
                      !disabled &&
                      !selected &&
                      styles.dayPressedTint,
                    isToday && !selected && styles.todayCircle,
                    selected && styles.selectedCircle,
                    pressed && !disabled && styles.dayPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      disabled && styles.disabledText,
                      selected && styles.selectedText,
                    ]}
                  >
                    {new Date(timestamp).getDate()}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    opacity: 0.25,
  },
  navText: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.textSecondary,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 10,
    color: colors.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  cell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    borderWidth: 1,
    borderColor: colors.text,
  },
  selectedCircle: {
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  dayPressedTint: {
    backgroundColor: colors.rangeTint,
  },
  dayPressed: {
    transform: [{ scale: 0.94 }],
  },
  dayText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  disabledText: {
    color: colors.muted,
    opacity: 0.4,
  },
  selectedText: {
    fontWeight: '600',
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.65,
  },
});
