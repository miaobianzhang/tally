import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { getCategory } from '../constants/categories';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, radius, spacing } from '../theme';
import type { PlanItem } from '../types';

export interface LaunchOrigin {
  x: number;
  y: number;
}

interface PlanLaunchOverlayProps {
  plan: PlanItem;
  origin: LaunchOrigin;
  started: boolean;
  onNavigate: () => void;
  onDone: () => void;
}

const RING_SIZE = 180;
const TINT_OPACITY = 0.14;

export function PlanLaunchOverlay({
  plan,
  origin,
  started,
  onNavigate,
  onDone,
}: PlanLaunchOverlayProps) {
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const category = getCategory(plan.category);

  const [veilOpacity] = useState(() => new Animated.Value(0));
  const [tintOpacity] = useState(() => new Animated.Value(0));
  const [contentOpacity] = useState(() => new Animated.Value(0));
  const [contentShift] = useState(() => new Animated.Value(8));
  const [ringOneScale] = useState(() => new Animated.Value(0.2));
  const [ringOneOpacity] = useState(() => new Animated.Value(0));
  const [ringTwoScale] = useState(() => new Animated.Value(0.2));
  const [ringTwoOpacity] = useState(() => new Animated.Value(0));
  const [entered, setEntered] = useState(false);

  const mountedRef = useRef(true);
  const leavingRef = useRef(false);
  const doneRef = useRef(false);

  const originX = Number.isFinite(origin.x)
    ? Math.max(0, Math.min(width, origin.x))
    : width / 2;
  const originY = Number.isFinite(origin.y)
    ? Math.max(0, Math.min(height, origin.y))
    : height / 2;

  useEffect(() => {
    mountedRef.current = true;
    const duration = reduceMotion ? 100 : 360;
    const enter = Animated.parallel([
      Animated.timing(veilOpacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tintOpacity, {
        toValue: reduceMotion ? 0.1 : TINT_OPACITY,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: reduceMotion ? 100 : 220,
        delay: reduceMotion ? 0 : 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentShift, {
        toValue: 0,
        duration: reduceMotion ? 100 : 260,
        delay: reduceMotion ? 0 : 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    enter.start(({ finished }) => {
      if (finished && mountedRef.current) setEntered(true);
    });

    let rings: Animated.CompositeAnimation | null = null;
    if (!reduceMotion) {
      ringOneScale.setValue(0.2);
      ringOneOpacity.setValue(0.5);
      ringTwoScale.setValue(0.2);
      ringTwoOpacity.setValue(0.35);
      rings = Animated.parallel([
        Animated.sequence([
          Animated.delay(30),
          Animated.parallel([
            Animated.timing(ringOneScale, {
              toValue: 2.4,
              duration: 420,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(ringOneOpacity, {
              toValue: 0,
              duration: 420,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(110),
          Animated.parallel([
            Animated.timing(ringTwoScale, {
              toValue: 2.1,
              duration: 390,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(ringTwoOpacity, {
              toValue: 0,
              duration: 390,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]);
      rings.start();
    }

    return () => {
      mountedRef.current = false;
      enter.stop();
      rings?.stop();
      [
        veilOpacity,
        tintOpacity,
        contentOpacity,
        contentShift,
        ringOneScale,
        ringOneOpacity,
        ringTwoScale,
        ringTwoOpacity,
      ].forEach((value) => value.stopAnimation());
    };
  }, [
    contentOpacity,
    contentShift,
    reduceMotion,
    ringOneOpacity,
    ringOneScale,
    ringTwoOpacity,
    ringTwoScale,
    tintOpacity,
    veilOpacity,
  ]);

  useEffect(() => {
    if (!entered || !started || leavingRef.current) return;

    leavingRef.current = true;
    onNavigate();

    const leave = Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: reduceMotion ? 60 : 110,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(reduceMotion ? 0 : 40),
        Animated.timing(veilOpacity, {
          toValue: 0,
          duration: reduceMotion ? 100 : 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    leave.start(({ finished }) => {
      if (!finished || doneRef.current) return;
      doneRef.current = true;
      if (mountedRef.current) onDone();
    });

    return () => {
      leave.stop();
    };
  }, [
    contentOpacity,
    entered,
    onDone,
    onNavigate,
    reduceMotion,
    started,
    veilOpacity,
  ]);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        // The overlay is a short, non-interactive transition. Ignore back
        // until it has navigated to the running timer.
      }}
    >
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={`开始计时：${plan.title}，${category.label}`}
        style={[styles.root, { opacity: veilOpacity }]}
      >
        <View style={styles.page} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tint,
            {
              backgroundColor: category.color,
              opacity: tintOpacity,
            },
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: originX - RING_SIZE / 2,
              top: originY - RING_SIZE / 2,
              borderColor: category.color,
              opacity: ringOneOpacity,
              transform: [{ scale: ringOneScale }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: originX - RING_SIZE / 2,
              top: originY - RING_SIZE / 2,
              borderColor: category.color,
              opacity: ringTwoOpacity,
              transform: [{ scale: ringTwoScale }],
            },
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.content,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentShift }],
            },
          ]}
        >
          <Text style={styles.kicker}>计划</Text>
          <Text numberOfLines={2} style={styles.title}>
            {plan.title}
          </Text>
          <View style={styles.metaRow}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: category.color },
              ]}
            />
            <Text style={styles.meta}>{category.label}</Text>
          </View>
          <View style={styles.actionPill}>
            <Text style={styles.actionText}>开始计时</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  page: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.page,
  },
  tint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  content: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 3,
    color: colors.muted,
  },
  title: {
    marginTop: spacing.md,
    maxWidth: 340,
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.text,
  },
  metaRow: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionPill: {
    marginTop: spacing.xxl,
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.onAccent,
  },
});
