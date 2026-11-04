import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAN_SECTION_LABELS } from '../constants/plans';
import { usePlans } from '../hooks/usePlans';
import { colors, radius, spacing } from '../theme';
import type {
  CategoryId,
  PlanItem,
  PlanSection,
} from '../types';
import {
  addDays,
  formatFullDateWithYear,
} from '../utils/dateRange';
import { hapticNotificationSuccess } from '../utils/haptics';
import { normalizePlanTitle, planPeriodLabel } from '../utils/plans';
import { dayStart } from '../utils/time';
import { CategoryPicker } from './CategoryPicker';
import { DateCalendar } from './DateCalendar';

interface PlanItemSheetProps {
  section: PlanSection;
  plan: PlanItem | null;
  periodStart: number | null;
  defaultCategory: CategoryId;
  now: number;
  onClose: () => void;
}

export function PlanItemSheet({
  section,
  plan,
  periodStart,
  defaultCategory,
  now,
  onClose,
}: PlanItemSheetProps) {
  const { busy, addPlan, updatePlan, removePlan } = usePlans();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(plan?.title ?? '');
  const [category, setCategory] = useState<CategoryId>(
    plan?.category ?? defaultCategory,
  );
  const [dueAt, setDueAt] = useState(
    plan?.dueAt ?? dayStart(addDays(now, 7)),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  const editing = plan !== null;
  const effectivePeriod = plan?.periodStart ?? periodStart;
  const periodLabel = planPeriodLabel(section, effectivePeriod);
  const canSave =
    normalizePlanTitle(title).length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;

    const saved = plan
      ? await updatePlan(plan.id, {
          title,
          category,
          ...(section === 'deadline' ? { dueAt } : {}),
        })
      : await addPlan({
          section,
          title,
          category,
          periodStart,
          dueAt: section === 'deadline' ? dueAt : null,
        });

    if (saved) {
      hapticNotificationSuccess();
      onClose();
    } else {
      Alert.alert('保存失败', '请重试。');
    }
  };

  const confirmDelete = () => {
    if (!plan || busy) return;

    Alert.alert('删除这条计划？', '删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const removed = await removePlan(plan.id);
            if (removed) {
              hapticNotificationSuccess();
              onClose();
            } else {
              Alert.alert('删除失败', '请重试。');
            }
          })();
        },
      },
    ]);
  };

  const titleText = editing
    ? '编辑计划'
    : `添加${PLAN_SECTION_LABELS[section]}`;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭计划编辑"
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              contentContainerStyle={styles.scrollContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>{titleText}</Text>
              <Text style={styles.subtitle}>
                {PLAN_SECTION_LABELS[section]}
                {periodLabel ? ` · ${periodLabel}` : ''}
              </Text>

              <Text style={styles.label}>活动名称</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="想完成什么？"
                placeholderTextColor={colors.muted}
                autoFocus={!editing}
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={styles.input}
              />

              <Text style={styles.label}>分类</Text>
              <CategoryPicker
                value={category}
                onChange={setCategory}
                disabled={busy}
              />

              {section === 'deadline' ? (
                <>
                  <Text style={styles.label}>截止日期</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`截止日期 ${formatFullDateWithYear(dueAt)}，点击更改`}
                    onPress={() => setCalendarOpen((open) => !open)}
                    style={({ pressed }) => [
                      styles.dateRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.dateText}>
                      {formatFullDateWithYear(dueAt)}
                    </Text>
                    <Text style={styles.dateAction}>
                      {calendarOpen ? '收起' : '更改'}
                    </Text>
                  </Pressable>

                  {calendarOpen ? (
                    <View style={styles.calendar}>
                      <DateCalendar
                        value={dueAt}
                        onChange={setDueAt}
                        now={now}
                      />
                    </View>
                  ) : null}
                </>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="取消"
                  onPress={onClose}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.cancel,
                    pressed && !busy && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelText}>取消</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="保存计划"
                  accessibilityState={{ disabled: !canSave }}
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={!canSave}
                  style={({ pressed }) => [
                    styles.save,
                    !canSave && styles.saveDisabled,
                    pressed && canSave && styles.pressed,
                  ]}
                >
                  <Text style={styles.saveText}>保存</Text>
                </Pressable>
              </View>

              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="删除计划"
                  onPress={confirmDelete}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.delete,
                    pressed && !busy && styles.pressed,
                  ]}
                >
                  <Text style={styles.deleteText}>删除计划</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    paddingBottom: spacing.sm,
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
  label: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  dateRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  dateAction: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  calendar: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
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
  save: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: {
    opacity: 0.35,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onAccent,
  },
  delete: {
    height: 48,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    fontSize: 14,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
});
