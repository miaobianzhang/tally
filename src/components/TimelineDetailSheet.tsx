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

import { getCategory } from '../constants/categories';
import { useTally } from '../hooks/useTally';
import { colors, radius, spacing } from '../theme';
import type { CategoryId } from '../types';
import { hapticNotificationSuccess } from '../utils/haptics';
import type { TimelineDay, TimelineSegment } from '../utils/timeline';
import { formatSegmentRange } from '../utils/timeline';
import { formatDuration } from '../utils/time';
import { CategoryPicker } from './CategoryPicker';

interface TimelineDetailSheetProps {
  segment: TimelineSegment | null;
  day: TimelineDay | null;
  onClose: () => void;
}

export function TimelineDetailSheet({
  segment,
  day,
  onClose,
}: TimelineDetailSheetProps) {
  if (!segment || !day) return null;
  return (
    <TimelineDetailContent
      key={segment.id}
      segment={segment}
      day={day}
      onClose={onClose}
    />
  );
}

interface TimelineDetailContentProps {
  segment: TimelineSegment;
  day: TimelineDay;
  onClose: () => void;
}

function TimelineDetailContent({
  segment,
  day,
  onClose,
}: TimelineDetailContentProps) {
  const { sessions, busy, updateSession } = useTally();
  const insets = useSafeAreaInsets();
  const session =
    sessions.find((item) => item.id === segment.sessionId) ?? null;
  const currentActivity = session?.activity ?? segment.activity;
  const currentCategory = session?.category ?? segment.category;

  const [editing, setEditing] = useState(false);
  const [activity, setActivity] = useState(currentActivity);
  const [category, setCategory] = useState<CategoryId>(currentCategory);

  const categoryMeta = getCategory(
    editing ? category : currentCategory,
  );
  const canEdit = session !== null;
  const canSave =
    editing &&
    session !== null &&
    activity.trim().length > 0 &&
    !busy;

  const startEditing = () => {
    setActivity(currentActivity);
    setCategory(currentCategory);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!canSave || !session) return;
    const saved = await updateSession(
      session.id,
      activity,
      category,
    );
    if (saved) {
      hapticNotificationSuccess();
      onClose();
    } else {
      Alert.alert('保存失败', '请重试。');
    }
  };

  const handleRequestClose = () => {
    if (editing) {
      setEditing(false);
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭活动明细"
          onPress={handleRequestClose}
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
              <Text style={styles.title}>
                {editing ? '编辑活动' : '活动明细'}
              </Text>
              <Text style={styles.subtitle}>
                {day.label} {day.dateLabel} ·{' '}
                {formatSegmentRange(segment, day)}
              </Text>

              {editing ? (
                <>
                  <Text style={styles.label}>活动名称</Text>
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
                  <CategoryPicker
                    value={category}
                    onChange={setCategory}
                    disabled={busy}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.activity}>
                    {currentActivity}
                  </Text>

                  <View style={styles.metaRow}>
                    <View
                      style={[
                        styles.categoryDot,
                        { backgroundColor: categoryMeta.color },
                      ]}
                    />
                    <Text style={styles.categoryText}>
                      {categoryMeta.label}
                    </Text>
                    <Text style={styles.duration}>
                      {formatDuration(segment.ms)}
                    </Text>
                  </View>
                </>
              )}

              {segment.crossesMidnight ? (
                <Text style={styles.note}>
                  {editing
                    ? '这段记录跨过午夜，修改会同步到它在每一天的显示。'
                    : '这段记录跨过午夜，时间轴按天拆分显示。'}
                </Text>
              ) : null}

              {editing ? (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="取消编辑"
                    onPress={() => setEditing(false)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.secondaryText}>取消</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="保存活动修改"
                    accessibilityState={{ disabled: !canSave }}
                    onPress={() => {
                      void handleSave();
                    }}
                    disabled={!canSave}
                    style={({ pressed }) => [
                      styles.primary,
                      !canSave && styles.primaryDisabled,
                      pressed && canSave && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>保存</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  {canEdit ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="编辑活动名称和分类"
                      onPress={startEditing}
                      style={({ pressed }) => [
                        styles.secondary,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.secondaryText}>编辑</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="关闭活动明细"
                    onPress={onClose}
                    style={({ pressed }) => [
                      styles.primary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryText}>关闭</Text>
                  </Pressable>
                </View>
              )}
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
    maxHeight: '88%',
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
    fontVariant: ['tabular-nums'],
  },
  activity: {
    marginTop: spacing.xl,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '600',
    color: colors.text,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  duration: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  note: {
    marginTop: spacing.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  secondary: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: {
    opacity: 0.35,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
});
