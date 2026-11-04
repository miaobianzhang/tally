import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, spacing } from '../theme';
import {
  DAY_LABEL_METRICS,
  DAY_TIMELINE,
  layoutDayTimeline,
  type DayTimelineBlock,
} from '../utils/dayTimeline';
import { formatDuration, pad2 } from '../utils/time';
import {
  formatSegmentRange,
  type TimelineDay,
  type TimelineSegment,
} from '../utils/timeline';
import { TimelineDetailSheet } from './TimelineDetailSheet';

interface VerticalDayTimelineProps {
  days: TimelineDay[];
  now: number;
}

interface SelectedSegment {
  segment: TimelineSegment;
  day: TimelineDay;
}

const MINOR_HOURS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];

/**
 * A true 0–24 clock axis for today. Each segment is a narrow bar at its real
 * start time and duration; its activity and time range sit in the lane to the
 * right, with collision-avoided labels connected back to the bar.
 */
export function VerticalDayTimeline({
  days,
  now,
}: VerticalDayTimelineProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<SelectedSegment | null>(null);
  const day = days[0];

  if (!day) return null;

  if (day.segments.length === 0) {
    return <Text style={styles.empty}>今天还没有已保存的时段。</Text>;
  }

  const layout = layoutDayTimeline(
    day.segments,
    day,
    width > 0 ? width : 310,
  );
  const nowTop =
    day.end > day.start && now >= day.start && now < day.end
      ? ((now - day.start) / (day.end - day.start)) * layout.height
      : null;

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== width) {
      setWidth(nextWidth);
    }
  };

  const openSegment = (segment: TimelineSegment) => {
    setSelected({ segment, day });
  };

  const accessibilityLabel = (segment: TimelineSegment) =>
    `${formatSegmentRange(segment, day)}，${segment.activity}，${segment.categoryLabel}，${formatDuration(segment.ms)}${segment.crossesMidnight ? '，跨天记录' : ''}`;

  const renderConnector = (block: DayTimelineBlock) => {
    const label = block.label;
    const color = block.segment.color;
    const verticalTop = Math.min(label.anchorY, label.centerY);
    const verticalHeight = Math.abs(label.anchorY - label.centerY);

    return (
      <View key={`connector-${block.segment.id}`} pointerEvents="none">
        <View
          style={[
            styles.connectorHorizontal,
            {
              left: DAY_TIMELINE.connectorStartX,
              top: label.anchorY - 0.5,
              width:
                label.busX - DAY_TIMELINE.connectorStartX,
              backgroundColor: color,
            },
          ]}
        />
        {verticalHeight >= 0.5 ? (
          <View
            style={[
              styles.connectorVertical,
              {
                left: label.busX - 0.5,
                top: verticalTop,
                height: verticalHeight,
                backgroundColor: color,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.connectorHorizontal,
            {
              left: label.busX,
              top: label.centerY - 0.5,
              width:
                DAY_TIMELINE.connectorEndX - label.busX,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    );
  };

  const renderBlock = (block: DayTimelineBlock) => {
    const { segment } = block;

    return (
      <Pressable
        key={segment.id}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel(segment)}
        onPress={() => openSegment(segment)}
        hitSlop={{ top: 6, bottom: 6, right: 2 }}
        style={({ pressed }) => [
          styles.block,
          {
            top: block.top,
            height: block.height,
            backgroundColor: segment.color,
            borderRadius: Math.min(6, block.height / 2),
          },
          pressed && styles.pressed,
        ]}
      />
    );
  };

  const renderLabel = (block: DayTimelineBlock) => {
    const label = block.label;
    const metrics = DAY_LABEL_METRICS[label.mode];
    const { segment } = block;
    const meta = `${formatSegmentRange(segment, day)} · ${formatDuration(segment.ms)}${
      segment.crossesMidnight ? ' · 跨天' : ''
    }`;

    return (
      <Pressable
        key={`label-${segment.id}`}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={() => openSegment(segment)}
        hitSlop={2}
        style={({ pressed }) => [
          styles.label,
          {
            left: label.left,
            top: label.top,
            width: label.width,
            height: label.height,
          },
          pressed && styles.pressed,
        ]}
      >
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.labelTitle,
            label.mode === 'compact' && styles.labelTitleCompact,
            label.mode === 'dense' && styles.labelTitleDense,
          ]}
        >
          {segment.activity}
        </Text>
        {metrics.showMeta ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.labelMeta}
          >
            {meta}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View>
      <Text style={styles.hint}>
        共 {day.segments.length} 段 · 左侧色块按真实时间落位 ·
        右侧标注活动与时长 · 点击块或标签查看明细
      </Text>

      <View
        style={[styles.board, { height: layout.height }]}
        onLayout={handleLayout}
      >
        {layout.hourTicks.map((tick) => (
          <Text
            key={`tick-${tick.hour}`}
            allowFontScaling={false}
            style={[styles.tickLabel, { top: tick.labelTop }]}
          >
            {pad2(tick.hour)}:00
          </Text>
        ))}

        <View
          style={[
            styles.track,
            {
              left: layout.trackLeft,
              width: layout.trackWidth,
              height: layout.height,
            },
          ]}
        >
          {MINOR_HOURS.map((hour) => (
            <View
              key={`minor-${hour}`}
              pointerEvents="none"
              style={[
                styles.minorLine,
                { top: hour * DAY_TIMELINE.hourHeight },
              ]}
            />
          ))}

          {layout.hourTicks.map((tick) => (
            <View
              key={`major-${tick.hour}`}
              pointerEvents="none"
              style={[styles.majorLine, { top: tick.lineTop }]}
            />
          ))}

          {layout.blocks.map(renderConnector)}
          {layout.blocks.map(renderBlock)}

          {nowTop !== null ? (
            <>
              <View
                pointerEvents="none"
                style={[styles.nowLine, { top: nowTop }]}
              />
              <View
                pointerEvents="none"
                style={[styles.nowDot, { top: nowTop - 3 }]}
              />
            </>
          ) : null}

          {layout.blocks.map(renderLabel)}
        </View>
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
    marginTop: 4,
    marginBottom: spacing.md,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  board: {
    position: 'relative',
    width: '100%',
  },
  tickLabel: {
    position: 'absolute',
    left: 0,
    width: DAY_TIMELINE.axisWidth,
    includeFontPadding: false,
    textAlign: 'right',
    fontSize: 9,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
    color: colors.muted,
  },
  track: {
    position: 'absolute',
    top: 0,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.page,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  minorLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.rangeTint,
  },
  majorLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  block: {
    position: 'absolute',
    left: 0,
    width: DAY_TIMELINE.barWidth,
    overflow: 'hidden',
  },
  connectorHorizontal: {
    position: 'absolute',
    height: 1,
    opacity: 0.45,
  },
  connectorVertical: {
    position: 'absolute',
    width: 1,
    opacity: 0.45,
  },
  label: {
    position: 'absolute',
    justifyContent: 'center',
    paddingLeft: DAY_TIMELINE.labelPadLeft,
    paddingRight: DAY_TIMELINE.labelPadRight,
    borderRadius: 6,
    backgroundColor: colors.page,
    overflow: 'hidden',
  },
  labelTitle: {
    includeFontPadding: false,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '600',
    color: colors.text,
  },
  labelTitleCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  labelTitleDense: {
    fontSize: 9.5,
    lineHeight: 12,
  },
  labelMeta: {
    includeFontPadding: false,
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: colors.running,
  },
  nowDot: {
    position: 'absolute',
    left: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.running,
  },
  empty: {
    paddingVertical: spacing.xl,
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.7,
  },
});
