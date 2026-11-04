import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';

import { colors, radius, spacing } from '../theme';
import { readableTextColor } from '../utils/chart';
import type { TimelineDay, TimelineSegment } from '../utils/timeline';
import {
  formatSegmentRange,
  minutesOfDay,
} from '../utils/timeline';
import { formatDuration } from '../utils/time';
import { TimelineDetailSheet } from './TimelineDetailSheet';

interface TimelineBoardProps {
  days: TimelineDay[];
  variant: 'day' | 'week';
  now: number;
}

const LABEL_WIDTH = 48;
const HOUR_WIDTH = 48;
const TRACK_WIDTH = HOUR_WIDTH * 24;
const AXIS_HEIGHT = 22;
const DAY_ROW_HEIGHT = 54;
const WEEK_ROW_HEIGHT = 46;
const BLOCK_HEIGHT = 28;
const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24] as const;

function dayRatio(timestamp: number, day: TimelineDay): number {
  const span = day.end - day.start;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (timestamp - day.start) / span));
}

function initialScrollX(days: TimelineDay[], now: number): number {
  const starts = days
    .flatMap((day) => day.segments.map((segment) => segment.start))
    .filter((value) => Number.isFinite(value));
  const hour =
    starts.length > 0
      ? Math.min(...starts.map((value) => minutesOfDay(value) / 60))
      : new Date(now).getHours() - 1;

  return Math.max(
    0,
    Math.min(
      TRACK_WIDTH - HOUR_WIDTH * 4,
      (hour - 1) * HOUR_WIDTH,
    ),
  );
}

export function TimelineBoard({
  days,
  variant,
  now,
}: TimelineBoardProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const hasScrolled = useRef(false);
  const [selected, setSelected] = useState<{
    segment: TimelineSegment;
    day: TimelineDay;
  } | null>(null);

  if (days.length === 0) return null;

  const rowHeight =
    variant === 'week' ? WEEK_ROW_HEIGHT : DAY_ROW_HEIGHT;
  const todayStart = new Date(
    new Date(now).getFullYear(),
    new Date(now).getMonth(),
    new Date(now).getDate(),
  ).getTime();
  const nowMinutes = minutesOfDay(now);

  const handleLayout = () => {
    if (hasScrolled.current) return;
    hasScrolled.current = true;
    scrollRef.current?.scrollTo({
      x: initialScrollX(days, now),
      animated: false,
    });
  };

  return (
    <View>
      <Text style={styles.hint}>
        左右滑动查看 0–24 时 · 点击色块查看活动明细
      </Text>

      <View style={styles.board}>
        <View style={styles.labelColumn}>
          <View style={{ height: AXIS_HEIGHT }} />
          {days.map((day) => (
            <View
              key={day.start}
              style={[styles.dayLabel, { height: rowHeight }]}
            >
              <Text style={styles.weekday}>{day.label}</Text>
              <Text style={styles.date}>{day.dateLabel}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onContentSizeChange={handleLayout}
          style={styles.scroll}
        >
          <View style={{ width: TRACK_WIDTH }}>
            <View style={[styles.axis, { height: AXIS_HEIGHT }]}>
              {TICK_HOURS.map((hour) => (
                <Text
                  key={hour}
                  style={[
                    styles.tickLabel,
                    {
                      left:
                        hour === 24
                          ? TRACK_WIDTH - 30
                          : hour === 0
                            ? 0
                            : hour * HOUR_WIDTH - 15,
                      textAlign:
                        hour === 24
                          ? 'right'
                          : hour === 0
                            ? 'left'
                            : 'center',
                    },
                  ]}
                >
                  {hour}:00
                </Text>
              ))}
            </View>

            {days.map((day) => {
              const isToday = day.start === todayStart;

              return (
                <View
                  key={day.start}
                  style={[styles.row, { height: rowHeight }]}
                >
                  {TICK_HOURS.slice(0, -1).map((hour) => (
                    <View
                      key={hour}
                      pointerEvents="none"
                      style={[
                        styles.gridLine,
                        {
                          left: hour * HOUR_WIDTH,
                          height: rowHeight,
                        },
                      ]}
                    />
                  ))}

                  {day.segments.map((segment) => {
                    const startRatio = dayRatio(segment.start, day);
                    const endRatio = dayRatio(segment.end, day);
                    const width = Math.max(
                      4,
                      (endRatio - startRatio) * TRACK_WIDTH - 1,
                    );
                    const range = formatSegmentRange(segment, day);

                    return (
                      <Pressable
                        key={segment.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${range}，${segment.activity}，${segment.categoryLabel}，${formatDuration(segment.ms)}。点击查看活动明细`}
                        hitSlop={6}
                        onPress={() =>
                          setSelected({ segment, day })
                        }
                        style={({ pressed }) => [
                          styles.block,
                          {
                            left: startRatio * TRACK_WIDTH,
                            width,
                            top: (rowHeight - BLOCK_HEIGHT) / 2,
                            backgroundColor: segment.color,
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        {width >= 18 ? (
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.blockText,
                              {
                                color: readableTextColor(
                                  segment.color,
                                ),
                              },
                            ]}
                          >
                            {segment.activity}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}

                  {isToday && nowMinutes >= 0 ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.nowLine,
                        {
                          left:
                            (nowMinutes / 1440) * TRACK_WIDTH,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <TimelineDetailSheet
        segment={selected?.segment ?? null}
        day={selected?.day ?? null}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  board: {
    flexDirection: 'row',
    borderRadius: radius.md,
    backgroundColor: colors.page,
    overflow: 'hidden',
  },
  labelColumn: {
    width: LABEL_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.page,
    zIndex: 1,
  },
  dayLabel: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  weekday: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  date: {
    marginTop: 1,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    color: colors.muted,
  },
  scroll: {
    flex: 1,
  },
  axis: {
    position: 'relative',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tickLabel: {
    position: 'absolute',
    top: 3,
    width: 30,
    fontSize: 9,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
    color: colors.muted,
  },
  row: {
    position: 'relative',
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  block: {
    position: 'absolute',
    height: BLOCK_HEIGHT,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blockText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: colors.running,
  },
});
