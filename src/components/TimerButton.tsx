import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius } from '../theme';
import type { TimerState } from '../types';
import {
  hapticImpactLight,
  hapticNotificationSuccess,
} from '../utils/haptics';

interface TimerButtonProps {
  status: TimerState['status'];
  startedAt?: number;
  disabled: boolean;
  onPress: () => void;
}

const RIPPLE_DURATION = 600;

export function TimerButton({
  status,
  startedAt,
  disabled,
  onPress,
}: TimerButtonProps) {
  const reduceMotion = useReduceMotion();
  const isFocused = useIsFocused();

  const [pressScale] = useState(() => new Animated.Value(1));
  const [rippleOneScale] = useState(() => new Animated.Value(0.7));
  const [rippleOneOpacity] = useState(() => new Animated.Value(0));
  const [rippleTwoScale] = useState(() => new Animated.Value(0.7));
  const [rippleTwoOpacity] = useState(() => new Animated.Value(0));
  const [glowScale] = useState(() => new Animated.Value(1));
  const [glowOpacity] = useState(() => new Animated.Value(0));
  const previousStatus = useRef(status);
  const firstRender = useRef(true);
  const lastStartEffect = useRef<number | null>(null);

  const playRipple = useCallback(
    (layer: 'one' | 'two') => {
      if (reduceMotion) return;

      const scale =
        layer === 'one' ? rippleOneScale : rippleTwoScale;
      const opacity =
        layer === 'one' ? rippleOneOpacity : rippleTwoOpacity;

      scale.stopAnimation();
      opacity.stopAnimation();
      scale.setValue(0.7);
      opacity.setValue(0.5);

      Animated.sequence([
        Animated.delay(layer === 'two' ? 90 : 0),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.5,
            duration: RIPPLE_DURATION,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: RIPPLE_DURATION,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    },
    [
      reduceMotion,
      rippleOneOpacity,
      rippleOneScale,
      rippleTwoOpacity,
      rippleTwoScale,
    ],
  );

  const playStart = useCallback(() => {
    playRipple('one');
    playRipple('two');
    hapticImpactLight();
  }, [playRipple]);

  const playStop = useCallback(() => {
    playRipple('one');
    hapticNotificationSuccess();
  }, [playRipple]);

  // Only announce a start when the timer screen is actually visible. Starting
  // from the plan tab navigates here immediately, so the effect still plays.
  useEffect(() => {
    if (
      status !== 'running' ||
      !isFocused ||
      startedAt === undefined ||
      Date.now() - startedAt >= 2000
    ) {
      return;
    }
    if (lastStartEffect.current === startedAt) return;
    lastStartEffect.current = startedAt;
    playStart();
  }, [isFocused, playStart, startedAt, status]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      previousStatus.current = status;
      return;
    }

    const previous = previousStatus.current;
    previousStatus.current = status;

    if (status === 'pending' && previous === 'running') {
      playStop();
    }
  }, [playStop, status]);

  useEffect(() => {
    if (status !== 'running' || reduceMotion || !isFocused) {
      glowScale.stopAnimation();
      glowOpacity.stopAnimation();
      glowOpacity.setValue(0);
      return;
    }

    glowScale.setValue(1);
    glowOpacity.setValue(0.18);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.035,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.05,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.18,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      glowOpacity.setValue(0);
    };
  }, [glowOpacity, glowScale, isFocused, reduceMotion, status]);

  const pressIn = () => {
    if (disabled || reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: 0.97,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 7,
      tension: 220,
      useNativeDriver: true,
    }).start();
  };

  const isRunning = status === 'running';
  const label =
    status === 'running'
      ? '结束'
      : status === 'pending'
        ? '等待记录'
        : '开始';
  const backgroundColor = isRunning || status === 'pending'
    ? colors.running
    : colors.accent;

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            borderColor: colors.running,
            opacity: rippleOneOpacity,
            transform: [{ scale: rippleOneScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            borderColor: colors.running,
            opacity: rippleTwoOpacity,
            transform: [{ scale: rippleTwoScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: colors.running,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isRunning ? '结束计时' : status === 'pending' ? '等待记录' : '开始计时'
          }
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor },
            disabled && styles.buttonDisabled,
            pressed && !disabled && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: '100%',
  },
  ripple: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderRadius: radius.pill,
  },
  glow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
  },
  button: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.onAccent,
  },
});
