import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import {
  FALLBACK_CATEGORY,
} from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { CategoryId } from '../types';
import { focusLabel as getFocusLabel, type TrendBucket } from '../utils/analytics';
import {
  ALL_ZOOM_OPTIONS,
  formatAxisDuration,
  niceTimeScale,
  roundedTopBarPath,
  Y_AXIS_WIDTH,
  type ChartZoom,
} from '../utils/chart';
import {
  computeVisibleRange,
  shouldUpdateWindow,
  type WindowRange,
} from '../utils/chartWindow';
import { formatDuration } from '../utils/time';

const BAR_HEIGHT = 132;
const LINE_HEIGHT = 132;
const PANEL_GAP = 28;
const X_LABEL_HEIGHT = 26;
const CHART_HEIGHT = BAR_HEIGHT + PANEL_GAP + LINE_HEIGHT + X_LABEL_HEIGHT;
const BAR_BASELINE = BAR_HEIGHT;
const LINE_BASELINE = BAR_HEIGHT + PANEL_GAP + LINE_HEIGHT;

interface DailyAnalysisChartsProps {
  buckets: TrendBucket[];
  maxMs: number;
  onSelectBucket: (bucket: TrendBucket) => void;
  zoomOptions?: readonly ChartZoom[];
}

interface Segment {
  id: CategoryId;
  ms: number;
  startMs: number;
  endMs: number;
  color: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function DailyAnalysisCharts({
  buckets,
  maxMs,
  onSelectBucket,
  zoomOptions,
}: DailyAnalysisChartsProps) {
  const { lookup } = useCategories();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const options = zoomOptions?.length ? zoomOptions : ALL_ZOOM_OPTIONS;
  const [zoom, setZoom] = useState<ChartZoom>(() =>
    options.includes(30) ? 30 : options[options.length - 1],
  );
  const [plotWidth, setPlotWidth] = useState(0);
  const [windowRange, setWindowRange] = useState<WindowRange>({
    first: 0,
    last: 0,
  });
  const windowRef = useRef(windowRange);
  const scrollXRef = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const anchorRef = useRef<number | null>(null);

  const activeZoom = options.includes(zoom)
    ? zoom
    : options[options.length - 1];
  const totalDays = buckets.length;
  const visibleDays = Math.min(activeZoom, Math.max(1, totalDays));
  const slotWidth = plotWidth > 0 ? plotWidth / visibleDays : 0;
  const contentWidth =
    totalDays > 0 && slotWidth > 0 ? totalDays * slotWidth : plotWidth;
  const overscan = Math.min(
    14,
    Math.max(7, Math.ceil(visibleDays / 2)),
  );
  const scale = useMemo(() => niceTimeScale(maxMs), [maxMs]);
  const yMaxMs = scale.maxMs;
  const first = windowRange.first;
  const last = windowRange.last;

  const categoryOrder = useMemo(() => {
    const ids = lookup.ordered.map((category) => category.id);
    const seen = new Set(ids);
    buckets.forEach((bucket) => {
      Object.keys(bucket.categoryMs).forEach((id) => {
        if (!seen.has(id) && bucket.categoryMs[id] > 0) {
          seen.add(id);
          ids.push(id);
        }
      });
    });
    return ids;
  }, [buckets, lookup.ordered]);

  const contentContainerStyle = useMemo(
    () => ({ width: Math.max(contentWidth, 1) }),
    [contentWidth],
  );
  const canvasStyle = useMemo(
    () => ({ width: Math.max(contentWidth, 1), height: CHART_HEIGHT }),
    [contentWidth],
  );

  const presentCategories = useMemo(
    () =>
      categoryOrder
        .map((id) => ({
          id,
          label: lookup.byId.get(id)?.label ?? FALLBACK_CATEGORY.label,
          color: lookup.byId.get(id)?.color ?? FALLBACK_CATEGORY.color,
          ms: buckets.reduce(
            (sum, bucket) => sum + (bucket.categoryMs[id] ?? 0),
            0,
          ),
        }))
        .filter((category) => category.ms > 0),
    [buckets, categoryOrder, lookup.byId],
  );

  const segmentData = useMemo(
    () =>
      buckets.map((bucket) => {
        let cumulative = 0;
        const segments: Segment[] = [];
        categoryOrder.forEach((id) => {
          const ms = bucket.categoryMs[id] ?? 0;
          if (ms <= 0) return;
          segments.push({
            id,
            ms,
            startMs: cumulative,
            endMs: cumulative + ms,
            color:
              lookup.byId.get(id)?.color ?? FALLBACK_CATEGORY.color,
          });
          cumulative += ms;
        });
        return segments;
      }),
    [buckets, categoryOrder, lookup.byId],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== plotWidth) setPlotWidth(width);
  };

  const applyWindow = (scrollX: number) => {
    const next = computeVisibleRange(
      scrollX,
      slotWidth,
      plotWidth,
      totalDays,
      overscan,
    );
    const previous = windowRef.current;
    if (!shouldUpdateWindow(previous, next, 4)) return;
    windowRef.current = next;
    setWindowRange(next);
  };

  const scrollToIndex = (index: number) => {
    if (!scrollRef.current || totalDays === 0 || slotWidth <= 0) return;
    const x = clamp(
      index * slotWidth + slotWidth / 2 - plotWidth / 2,
      0,
      Math.max(0, contentWidth - plotWidth),
    );
    scrollRef.current.scrollTo({ x, animated: false });
    scrollXRef.current = x;
    const next = computeVisibleRange(
      x,
      slotWidth,
      plotWidth,
      totalDays,
      overscan,
    );
    windowRef.current = next;
    setWindowRange(next);
  };

  useEffect(() => {
    if (totalDays === 0 || plotWidth <= 0) return;
    const anchor = anchorRef.current ?? totalDays - 1;
    anchorRef.current = null;
    scrollToIndex(anchor);
    // Only reposition when the range or zoom changes, not on every scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDays, activeZoom, plotWidth, slotWidth, contentWidth]);

  const handleZoom = (next: ChartZoom) => {
    if (next === activeZoom || totalDays === 0 || !options.includes(next)) {
      return;
    }
    const center = Math.floor(
      (scrollXRef.current + plotWidth / 2) /
        Math.max(slotWidth, 1),
    );
    anchorRef.current = clamp(center, 0, totalDays - 1);
    setZoom(next);
  };

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const x = event.nativeEvent.contentOffset.x;
    scrollXRef.current = x;
    applyWindow(x);
  };

  const yFor = useCallback(
    (valueMs: number, baseline: number, height: number) => {
      if (yMaxMs <= 0) return baseline;
      return baseline - clamp(valueMs / yMaxMs, 0, 1) * height;
    },
    [yMaxMs],
  );

  const xTicks = useMemo(() => {
    if (totalDays === 0 || slotWidth <= 0) return [] as number[];
    const maxLabels = Math.max(2, Math.floor(plotWidth / 56));
    const count = last - first + 1;
    const step = Math.max(1, Math.ceil(count / maxLabels));
    const ticks: number[] = [];
    for (let index = first; index <= last; index += step) {
      ticks.push(index);
    }
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
  }, [first, last, plotWidth, slotWidth, totalDays]);

  const labelIndices = useMemo(() => {
    if (totalDays === 0) return [] as number[];
    const count = last - first + 1;
    if (count <= 14) {
      return Array.from({ length: count }, (_, offset) => first + offset);
    }
    const result: number[] = [];
    const target = 7;
    for (let slot = 0; slot < target; slot += 1) {
      const index = Math.round(first + (slot * (count - 1)) / (target - 1));
      if (result[result.length - 1] !== index) result.push(index);
    }
    return result;
  }, [first, last, totalDays]);

  const totalPath = useMemo(() => {
    if (buckets.length < 2) return '';
    return buckets
      .map((bucket, index) => {
        const x = index * slotWidth + slotWidth / 2;
        const y = yFor(bucket.totalMs, LINE_BASELINE, LINE_HEIGHT);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`;
      })
      .join(' ');
  }, [buckets, slotWidth, yFor]);

  const studyPath = useMemo(() => {
    if (buckets.length < 2) return '';
    return buckets
      .map((bucket, index) => {
        const x = index * slotWidth + slotWidth / 2;
        const y = yFor(bucket.studyWorkMs, LINE_BASELINE, LINE_HEIGHT);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`;
      })
      .join(' ');
  }, [buckets, slotWidth, yFor]);

  const handlePress = (locationX: number) => {
    if (slotWidth <= 0 || totalDays === 0) return;
    const index = clamp(Math.floor(locationX / slotWidth), 0, totalDays - 1);
    const bucket = buckets[index];
    if (bucket && bucket.totalMs > 0) onSelectBucket(bucket);
  };

  const focusLabel = getFocusLabel(lookup);
  const visibleLabel =
    totalDays > 0
      ? `${buckets[first]?.label ?? ''}–${buckets[last]?.label ?? ''}`
      : '';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <Text style={styles.title}>每日时间分布与趋势</Text>
          <Text style={styles.hint}>
            按天 · {visibleLabel} · 左右滑动查看
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="回到最新日期"
          onPress={() => scrollToIndex(totalDays - 1)}
          style={({ pressed }) => [
            styles.latestButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.latestText}>最新</Text>
        </Pressable>
      </View>

      <View style={styles.zoomRow}>
        {options.map((value) => {
          const selected = value === activeZoom;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`显示 ${value} 天`}
              onPress={() => handleZoom(value)}
              style={({ pressed }) => [
                styles.zoomChip,
                selected && styles.zoomChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.zoomText,
                  selected && styles.zoomTextSelected,
                ]}
              >
                {value} 天
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: CHART_HEIGHT }]}>
          {scale.ticks.map((tick) => (
            <Text
              key={`bar-${tick}`}
              style={[
                styles.yLabel,
                { top: yFor(tick, BAR_BASELINE, BAR_HEIGHT) - 7 },
              ]}
            >
              {formatAxisDuration(tick)}
            </Text>
          ))}
          {scale.ticks.map((tick) => (
            <Text
              key={`line-${tick}`}
              style={[
                styles.yLabel,
                { top: yFor(tick, LINE_BASELINE, LINE_HEIGHT) - 7 },
              ]}
            >
              {formatAxisDuration(tick)}
            </Text>
          ))}
        </View>

        <View style={styles.plot} onLayout={handleLayout}>
          <ScrollView
            ref={scrollRef}
            horizontal
            nestedScrollEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            contentContainerStyle={contentContainerStyle}
          >
            <View style={canvasStyle}>
              <Svg
                width={Math.max(contentWidth, 1)}
                height={CHART_HEIGHT}
                pointerEvents="none"
              >
                {scale.ticks.map((tick) => (
                  <G key={`grid-${tick}`}>
                    <Line
                      x1={0}
                      y1={yFor(tick, BAR_BASELINE, BAR_HEIGHT)}
                      x2={contentWidth}
                      y2={yFor(tick, BAR_BASELINE, BAR_HEIGHT)}
                      stroke={colors.border}
                      strokeWidth={1}
                    />
                    <Line
                      x1={0}
                      y1={yFor(tick, LINE_BASELINE, LINE_HEIGHT)}
                      x2={contentWidth}
                      y2={yFor(tick, LINE_BASELINE, LINE_HEIGHT)}
                      stroke={colors.border}
                      strokeWidth={1}
                    />
                  </G>
                ))}
                <Line
                  x1={0}
                  y1={BAR_BASELINE}
                  x2={contentWidth}
                  y2={BAR_BASELINE}
                  stroke={colors.axis}
                  strokeWidth={1}
                />
                <Line
                  x1={0}
                  y1={LINE_BASELINE}
                  x2={contentWidth}
                  y2={LINE_BASELINE}
                  stroke={colors.axis}
                  strokeWidth={1}
                />

                {buckets.slice(first, last + 1).map((bucket, offset) => {
                  const index = first + offset;
                  if (bucket.totalMs <= 0 || yMaxMs <= 0) return null;
                  const segments = segmentData[index] ?? [];
                  const barWidth = clamp(slotWidth * 0.62, 2, 24);
                  const x = index * slotWidth + (slotWidth - barWidth) / 2;

                  return (
                    <G key={bucket.start}>
                      {segments.map((segment, position) => {
                        const bottomY = yFor(
                          segment.startMs,
                          BAR_BASELINE,
                          BAR_HEIGHT,
                        );
                        const topY = yFor(
                          segment.endMs,
                          BAR_BASELINE,
                          BAR_HEIGHT,
                        );
                        const height = Math.max(
                          segment.ms > 0 ? 1.5 : 0,
                          bottomY - topY,
                        );
                        const isTop = position === segments.length - 1;

                        return isTop && height >= 4 ? (
                          <Path
                            key={segment.id}
                            d={roundedTopBarPath(
                              x,
                              topY,
                              barWidth,
                              height,
                              3,
                            )}
                            fill={segment.color}
                          />
                        ) : (
                          <Rect
                            key={segment.id}
                            x={x}
                            y={Math.max(0, bottomY - height)}
                            width={barWidth}
                            height={height}
                            fill={segment.color}
                          />
                        );
                      })}
                      {segments.slice(0, -1).map((segment) => {
                        const y = yFor(
                          segment.endMs,
                          BAR_BASELINE,
                          BAR_HEIGHT,
                        );
                        return (
                          <Line
                            key={`sep-${segment.id}`}
                            x1={x}
                            y1={y}
                            x2={x + barWidth}
                            y2={y}
                            stroke={colors.surface}
                            strokeWidth={1}
                          />
                        );
                      })}
                    </G>
                  );
                })}

                {totalPath ? (
                  <Path
                    d={totalPath}
                    fill="none"
                    stroke={colors.textSecondary}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {studyPath ? (
                  <Path
                    d={studyPath}
                    fill="none"
                    stroke={colors.text}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}

                {labelIndices.map((index) => {
                  const bucket = buckets[index];
                  if (!bucket) return null;
                  const x = index * slotWidth + slotWidth / 2;
                  const totalY = yFor(bucket.totalMs, LINE_BASELINE, LINE_HEIGHT);
                  const studyY = yFor(
                    bucket.studyWorkMs,
                    LINE_BASELINE,
                    LINE_HEIGHT,
                  );
                  const textAnchor =
                    index === 0
                      ? 'start'
                      : index === totalDays - 1
                        ? 'end'
                        : 'middle';
                  return (
                    <G key={`point-${bucket.start}`}>
                      <Circle
                        cx={x}
                        cy={totalY}
                        r={3}
                        fill={colors.surface}
                        stroke={colors.textSecondary}
                        strokeWidth={2}
                      />
                      <Circle
                        cx={x}
                        cy={studyY}
                        r={3}
                        fill={colors.text}
                        stroke={colors.surface}
                        strokeWidth={2}
                      />
                      <SvgText
                        x={x}
                        y={Math.max(10, studyY - 7)}
                        textAnchor={textAnchor}
                        fontSize={9}
                        fontWeight="600"
                        fill="none"
                        stroke={colors.surface}
                        strokeWidth={3}
                        strokeLinejoin="round"
                      >
                        {formatAxisDuration(bucket.studyWorkMs)}
                      </SvgText>
                      <SvgText
                        x={x}
                        y={Math.max(10, studyY - 7)}
                        textAnchor={textAnchor}
                        fontSize={9}
                        fontWeight="600"
                        fill={colors.text}
                      >
                        {formatAxisDuration(bucket.studyWorkMs)}
                      </SvgText>
                      <SvgText
                        x={x}
                        y={Math.min(
                          LINE_BASELINE - 2,
                          Math.max(studyY + 14, totalY + 14),
                        )}
                        textAnchor={textAnchor}
                        fontSize={9}
                        fontWeight="600"
                        fill="none"
                        stroke={colors.surface}
                        strokeWidth={3}
                        strokeLinejoin="round"
                      >
                        {formatAxisDuration(bucket.totalMs)}
                      </SvgText>
                      <SvgText
                        x={x}
                        y={Math.min(
                          LINE_BASELINE - 2,
                          Math.max(studyY + 14, totalY + 14),
                        )}
                        textAnchor={textAnchor}
                        fontSize={9}
                        fontWeight="600"
                        fill={colors.textSecondary}
                      >
                        {formatAxisDuration(bucket.totalMs)}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>

              {xTicks.map((index) => {
                const bucket = buckets[index];
                if (!bucket) return null;
                const width = Math.min(Math.max(slotWidth, 30), 58);
                const left = clamp(
                  index * slotWidth + slotWidth / 2 - width / 2,
                  0,
                  Math.max(0, contentWidth - width),
                );
                const date = new Date(bucket.start);
                const label =
                  index === first || date.getMonth() === 0
                    ? `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
                    : bucket.label;
                return (
                  <Text
                    key={`x-${bucket.start}`}
                    numberOfLines={1}
                    style={[
                      styles.xLabel,
                      {
                        left,
                        width,
                        top: LINE_BASELINE + 6,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="点击查看某一天的明细"
                onPress={(event) => handlePress(event.nativeEvent.locationX)}
                style={[
                  { position: 'absolute', left: 0, right: 0, top: 0 },
                  { height: LINE_BASELINE },
                  styles.hitLayer,
                ]}
              />
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.legendRow}>
        {presentCategories.map((category) => (
          <View key={category.id} style={styles.swatch}>
            <View
              style={[styles.swatchDot, { backgroundColor: category.color }]}
            />
            <Text style={styles.swatchText}>{category.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.lineLegend}>
        <View style={styles.lineLegendItem}>
          <View style={[styles.lineSample, { backgroundColor: colors.text }]} />
          <Text style={styles.legendText}>{focusLabel}</Text>
        </View>
        <View style={styles.lineLegendItem}>
          <View
            style={[
              styles.lineSample,
              styles.dashedSample,
              { borderColor: colors.textSecondary },
            ]}
          />
          <Text style={styles.legendText}>全部活动</Text>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`每日时间分布与趋势，${visibleLabel}。${focusLabel}合计 ${formatDuration(
          buckets.reduce((sum, bucket) => sum + bucket.studyWorkMs, 0),
        )}，全部活动合计 ${formatDuration(
          buckets.reduce((sum, bucket) => sum + bucket.totalMs, 0),
        )}。`}
        style={styles.a11y}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerText: { flex: 1 },
    title: {
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    },
    hint: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
    },
    latestButton: {
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    latestText: { fontSize: 12, color: colors.textSecondary },
    zoomRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    zoomChip: {
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomChipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    zoomText: { fontSize: 12, color: colors.textSecondary },
    zoomTextSelected: { color: colors.onAccent, fontWeight: '600' },
    chartRow: {
      flexDirection: 'row',
      width: '100%',
      marginTop: 14,
    },
    yAxis: {
      width: Y_AXIS_WIDTH,
      position: 'relative',
    },
    yLabel: {
      position: 'absolute',
      right: 7,
      height: 14,
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'right',
      color: colors.muted,
    },
    plot: { flex: 1, height: CHART_HEIGHT },
    xLabel: {
      position: 'absolute',
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'center',
      color: colors.muted,
    },
    hitLayer: {
      left: 0,
      right: 0,
      top: 0,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
    },
    swatch: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    swatchDot: { width: 8, height: 8, borderRadius: 4 },
    swatchText: { fontSize: 12, color: colors.textSecondary },
    lineLegend: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    lineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lineSample: { width: 18, height: 2, borderRadius: 1 },
    dashedSample: {
      backgroundColor: 'transparent',
      borderTopWidth: 2,
      borderStyle: 'dashed',
      height: 0,
    },
    legendText: { fontSize: 12, color: colors.textSecondary },
    a11y: { position: 'absolute', width: 0, height: 0 },
    pressed: { opacity: 0.7 },
  });
