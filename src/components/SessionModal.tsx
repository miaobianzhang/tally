import { useEffect, useState } from 'react';
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

import { useReduceMotion } from '../hooks/useReduceMotion';
import { useTally } from '../hooks/useTally';
import { colors, radius, spacing } from '../theme';
import type { CategoryId, TimerState } from '../types';
import { formatClockTime, formatDuration } from '../utils/time';
import { CategoryPicker } from './CategoryPicker';

type PendingTimer = Extract<TimerState, { status: 'pending' }>;

const STOP_EFFECT_DELAY_MS = 260;

export function SessionModal() {
  const { timer, lastCategory } = useTally();
  const reduceMotion = useReduceMotion();
  const pendingId = timer.status === 'pending' ? timer.id : null;
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingId === null) return;

    const timeout = setTimeout(
      () => {
        setVisibleId(pendingId);
      },
      reduceMotion ? 0 : STOP_EFFECT_DELAY_MS,
    );

    return () => {
      clearTimeout(timeout);
    };
  }, [pendingId, reduceMotion]);

  if (timer.status !== 'pending' || visibleId !== timer.id) return null;

  return (
    <SessionSheet
      key={timer.id}
      pending={timer}
      initialActivity={timer.prefill?.activity ?? ''}
      initialCategory={timer.prefill?.category ?? lastCategory}
    />
  );
}

interface SessionSheetProps {
  pending: PendingTimer;
  initialActivity: string;
  initialCategory: CategoryId;
}

function SessionSheet({
  pending,
  initialActivity,
  initialCategory,
}: SessionSheetProps) {
  const { busy, savePending, discardPending } = useTally();
  const insets = useSafeAreaInsets();
  const [activity, setActivity] = useState(initialActivity);
  const [category, setCategory] = useState<CategoryId>(initialCategory);

  const durationMs = Math.max(0, pending.endedAt - pending.startedAt);
  const canSave = activity.trim().length > 0 && !busy;

  const confirmDiscard = () => {
    if (busy) return;
    Alert.alert('丢弃这段记录？', '计时数据将不会保存。', [
      { text: '取消', style: 'cancel' },
      {
        text: '丢弃',
        style: 'destructive',
        onPress: () => {
          void discardPending();
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!canSave) return;
    const saved = await savePending(activity, category);
    if (!saved) {
      Alert.alert('保存失败', '请重试。');
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={confirmDiscard}
    >
      <View style={styles.root}>
        <View style={styles.backdrop} />
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
              <Text style={styles.title}>记录这段时间</Text>
              <Text style={styles.subtitle}>
                {formatDuration(durationMs)} · {formatClockTime(pending.startedAt)}
                {' – '}
                {formatClockTime(pending.endedAt)}
              </Text>

              {pending.prefill ? (
                <Text style={styles.planHint}>
                  来自计划 · 活动名称和分类已预填，仍可修改
                </Text>
              ) : null}

              <Text style={styles.label}>活动内容</Text>
              <TextInput
                value={activity}
                onChangeText={setActivity}
                placeholder="刚才做了什么？"
                placeholderTextColor={colors.muted}
                autoFocus
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={styles.input}
              />

              <Text style={styles.label}>分类</Text>
              <CategoryPicker value={category} onChange={setCategory} />

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="丢弃这段记录"
                  onPress={confirmDiscard}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.discard,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.discardText}>丢弃</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="保存记录"
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
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  planHint: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.page,
    fontSize: 11,
    color: colors.textSecondary,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  discard: {
    height: 52,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: {
    fontSize: 15,
    color: colors.danger,
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
    color: colors.onAccent,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
