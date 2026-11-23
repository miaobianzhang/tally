import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCategories } from '../hooks/useCategories';
import { usePlans } from '../hooks/usePlans';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeColors } from '../theme/types';
import { spacing } from '../theme';
import type { PlanItem } from '../types';
import {
  hapticNotificationSuccess,
  hapticSelection,
} from '../utils/haptics';
import {
  deadlineDateLabel,
  deadlineLabel,
  deadlineTone,
  planPeriodLabel,
} from '../utils/plans';
import type { LaunchOrigin } from './PlanLaunchOverlay';

interface PlanItemRowProps {
  plan: PlanItem;
  now: number;
  busy: boolean;
  reduceMotion: boolean;
  onStart: (plan: PlanItem, origin: LaunchOrigin) => void;
  onEdit: (plan: PlanItem) => void;
}

export function PlanItemRow({
  plan,
  now,
  busy,
  reduceMotion,
  onStart,
  onEdit,
}: PlanItemRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { toggleComplete, removePlan } = usePlans();
  const { resolveCategory } = useCategories();
  const category = resolveCategory(plan.category);
  const completed = plan.completedAt !== null;
  const tone = deadlineTone(plan, now);
  const isDeadline = plan.section === 'deadline';
  const countdown = isDeadline ? deadlineLabel(plan, now) : '';
  const dueText = isDeadline
    ? deadlineDateLabel(plan)
    : planPeriodLabel(plan.section, plan.periodStart);
  const dueColor =
    tone === 'overdue'
      ? colors.danger
      : tone === 'today'
        ? colors.running
        : colors.textSecondary;

  const [boxScale] = useState(() => new Animated.Value(1));
  const [checkScale] = useState(
    () => new Animated.Value(completed ? 1 : 0.4),
  );
  const [checkOpacity] = useState(
    () => new Animated.Value(completed ? 1 : 0),
  );
  const [pulseScale] = useState(() => new Animated.Value(0.9));
  const [pulseOpacity] = useState(() => new Animated.Value(0));
  const previousCompleted = useRef(completed);

  useEffect(() => {
    const justCompleted = completed && !previousCompleted.current;
    previousCompleted.current = completed;

    if (justCompleted && !reduceMotion) {
      boxScale.stopAnimation();
      checkScale.stopAnimation();
      checkOpacity.stopAnimation();
      pulseScale.stopAnimation();
      pulseOpacity.stopAnimation();
      boxScale.setValue(1);
      checkScale.setValue(0.4);
      checkOpacity.setValue(0);
      pulseScale.setValue(0.9);
      pulseOpacity.setValue(0.5);

      Animated.parallel([
        Animated.sequence([
          Animated.timing(boxScale, {
            toValue: 1.16,
            duration: 110,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(boxScale, {
            toValue: 1,
            friction: 5,
            tension: 220,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 6,
          tension: 240,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 2,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      return () => {
        boxScale.stopAnimation();
        checkScale.stopAnimation();
        checkOpacity.stopAnimation();
        pulseScale.stopAnimation();
        pulseOpacity.stopAnimation();
      };
    }

    boxScale.setValue(1);
    checkScale.setValue(completed ? 1 : 0.4);
    checkOpacity.setValue(completed ? 1 : 0);
    pulseOpacity.setValue(0);
    return undefined;
  }, [
    boxScale,
    checkOpacity,
    checkScale,
    completed,
    pulseOpacity,
    pulseScale,
    reduceMotion,
  ]);

  const handleToggle = async () => {
    const saved = await toggleComplete(plan.id);
    if (saved) {
      hapticSelection();
    } else {
      Alert.alert('操作失败', '请重试。');
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    const removed = await removePlan(plan.id);
    if (removed) {
      hapticNotificationSuccess();
    } else {
      Alert.alert('删除失败', '请重试。');
    }
  };

  const meta = [category.label, dueText].filter(Boolean).join(' · ');
  const startLabel = `开始计时：${plan.title}，${category.label}${dueText ? `，${dueText}` : ''}${countdown ? `，${countdown}` : ''}`;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed, disabled: busy }}
        accessibilityLabel={
          completed
            ? `取消完成：${plan.title}`
            : `标记完成：${plan.title}`
        }
        disabled={busy}
        onPress={() => {
          void handleToggle();
        }}
        style={({ pressed }) => [
          styles.checkHit,
          pressed && !busy && styles.pressed,
        ]}
      >
        <View style={styles.checkWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulse,
              {
                borderColor: colors.accent,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.checkbox,
              completed && styles.checkboxDone,
              { transform: [{ scale: boxScale }] },
            ]}
          >
            {completed ? (
              <Animated.View
                style={{
                  opacity: checkOpacity,
                  transform: [{ scale: checkScale }],
                }}
              >
                <Text style={styles.check}>✓</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={startLabel}
        accessibilityState={{ disabled: completed }}
        disabled={completed}
        onPress={(event) =>
          onStart(plan, {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          })
        }
        style={({ pressed }) => [
          styles.main,
          pressed && !completed && styles.pressed,
        ]}
      >
        <View style={styles.titleRow}>
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              completed && styles.titleDone,
            ]}
          >
            {plan.title}
          </Text>
          {countdown ? (
            <Text
              numberOfLines={1}
              style={[
                styles.deadlineCountdown,
                { color: dueColor },
                completed && styles.metaDone,
              ]}
            >
              {countdown}
            </Text>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <View
            style={[
              styles.categoryDot,
              { backgroundColor: category.color },
            ]}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.meta,
              { color: dueColor },
              completed && styles.metaDone,
            ]}
          >
            {meta}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`编辑计划：${plan.title}`}
        disabled={busy}
        onPress={() => onEdit(plan)}
        style={({ pressed }) => [
          styles.edit,
          pressed && !busy && styles.pressed,
        ]}
      >
        <Text style={styles.editText}>编辑</Text>
      </Pressable>

      {completed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`删除已完成计划：${plan.title}`}
          disabled={busy}
          onPress={() => {
            void handleDelete();
          }}
          style={({ pressed }) => [
            styles.delete,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={styles.deleteText}>删除</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  checkHit: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkWrap: {
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.axis,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  check: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.onAccent,
  },
  main: {
    flex: 1,
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: colors.text,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  deadlineCountdown: {
    flexShrink: 0,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  meta: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  metaDone: {
    color: colors.muted,
    opacity: 0.75,
  },
  edit: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  delete: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  pressed: {
    opacity: 0.65,
  },
});
