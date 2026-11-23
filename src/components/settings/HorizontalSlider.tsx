import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';

const THUMB = 22;
const TRACK_HEIGHT = 26;

interface HorizontalSliderProps {
  value: number;
  onChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  min?: number;
  max?: number;
  colors?: readonly [string, string, ...string[]];
  accessibilityLabel?: string;
  formatValue?: (value: number) => string;
}

export function HorizontalSlider({
  value,
  onChange,
  onSlidingComplete,
  min = 0,
  max = 1,
  colors: trackColors,
  accessibilityLabel = '滑动调节',
  formatValue,
}: HorizontalSliderProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);
  const range = max - min || 1;
  const ratio = Math.max(0, Math.min(1, (value - min) / range));
  const thumbLeft = Math.max(
    0,
    Math.min(width - THUMB, ratio * (width - THUMB)),
  );

  const update = (locationX: number, complete: boolean) => {
    if (width <= 0) return;
    const nextRatio = Math.max(0, Math.min(1, locationX / width));
    const next = min + nextRatio * range;
    onChange(next);
    if (complete) onSlidingComplete?.(next);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) =>
          update(event.nativeEvent.locationX, false),
        onPanResponderMove: (event) =>
          update(event.nativeEvent.locationX, false),
        onPanResponderRelease: (event) =>
          update(event.nativeEvent.locationX, true),
        onPanResponderTerminate: (event) =>
          update(event.nativeEvent.locationX, true),
      }),
    // The responder intentionally reads the latest props through the closure
    // created on each value/width change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, min, max, value],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth(next);
  };

  return (
    <View
      onLayout={handleLayout}
      style={styles.root}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: Math.round(min * 100),
        max: Math.round(max * 100),
        now: Math.round(value * 100),
        text: formatValue?.(value),
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const step = range * 0.05;
        const next =
          event.nativeEvent.actionName === 'increment'
            ? value + step
            : value - step;
        onChange(Math.max(min, Math.min(max, next)));
      }}
      {...responder.panHandlers}
    >
      <View style={styles.track}>
        {trackColors ? (
          <LinearGradient
            colors={trackColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <>
            <View style={styles.trackBase} />
            <View
              style={[
                styles.trackFill,
                {
                  width: `${ratio * 100}%`,
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </>
        )}
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: thumbLeft,
            backgroundColor: trackColors
              ? colors.surface
              : colors.accent,
            borderColor: trackColors ? colors.text : colors.surface,
          },
        ]}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      height: 36,
      justifyContent: 'center',
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    trackBase: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.rangeTint,
    },
    trackFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: TRACK_HEIGHT / 2,
    },
    thumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      borderWidth: 2,
    },
  });
