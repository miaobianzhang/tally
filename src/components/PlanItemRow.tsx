import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCategory } from '../constants/categories';
import { usePlans } from '../hooks/usePlans';
import { colors, spacing } from '../theme';
import type { PlanItem } from '../types';
import { hapticSelection } from '../utils/haptics';
import {
  deadlineLabel,
  deadlineTone,
  planPeriodLabel,
} from '../utils/plans';
import type { LaunchOrigin } from './PlanLaunchOverlay';

interface PlanItemRowProps {
  plan: PlanItem;
  now: number;
  busy: boolean;
  onStart: (plan: PlanItem, origin: LaunchOrigin) => void;
  onEdit: (plan: PlanItem) => void;
}

export function PlanItemRow({
  plan,
  now,
  busy,
  onStart,
  onEdit,
}: PlanItemRowProps) {
  const { toggleComplete } = usePlans();
  const category = getCategory(plan.category);
  const completed = plan.completedAt !== null;
  const tone = deadlineTone(plan, now);
  const dueText =
    plan.section === 'deadline'
      ? deadlineLabel(plan, now)
      : planPeriodLabel(plan.section, plan.periodStart);
  const dueColor =
    tone === 'overdue'
      ? colors.danger
      : tone === 'today'
        ? colors.running
        : colors.textSecondary;

  const handleToggle = async () => {
    const saved = await toggleComplete(plan.id);
    if (saved) {
      hapticSelection();
    } else {
      Alert.alert('操作失败', '请重试。');
    }
  };

  const meta = [category.label, dueText].filter(Boolean).join(' · ');
  const startLabel = `开始计时：${plan.title}，${category.label}${dueText ? `，${dueText}` : ''}`;

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
        <View
          style={[
            styles.checkbox,
            completed && styles.checkboxDone,
          ]}
        >
          {completed ? <Text style={styles.check}>✓</Text> : null}
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
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            completed && styles.titleDone,
          ]}
        >
          {plan.title}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    color: colors.text,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.muted,
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
    width: 46,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.65,
  },
});
