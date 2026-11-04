import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import type { Session } from '../types';
import {
  buildBreakdown,
  type TrendBucket,
} from '../utils/analytics';
import { formatBucketTitle } from '../utils/dateRange';
import { formatDuration } from '../utils/time';
import { ActivityLegend } from './ActivityLegend';

interface BucketDetailSheetProps {
  bucket: TrendBucket | null;
  sessions: Session[];
  onClose: () => void;
}

export function BucketDetailSheet({
  bucket,
  sessions,
  onClose,
}: BucketDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const breakdown = useMemo(
    () => (bucket ? buildBreakdown(sessions, bucket) : null),
    [bucket, sessions],
  );

  if (!bucket || !breakdown) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.flex}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭活动明细"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.xl) },
          ]}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>活动明细</Text>
            <Text style={styles.subtitle}>
              {formatBucketTitle(bucket)} · {formatDuration(bucket.totalMs)}
            </Text>

            <View style={styles.legend}>
              {breakdown.categories.length > 0 ? (
                <ActivityLegend categories={breakdown.categories} />
              ) : (
                <Text style={styles.emptyText}>这个时段没有活动记录。</Text>
              )}
            </View>

            <Text style={styles.hint}>占比按该时段总计</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭活动明细"
              onPress={onClose}
              style={({ pressed }) => [
                styles.close,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.closeText}>关闭</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
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
  },
  legend: {
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  emptyText: {
    paddingVertical: spacing.lg,
    fontSize: 14,
    color: colors.muted,
  },
  hint: {
    marginTop: spacing.md,
    fontSize: 11,
    textAlign: 'right',
    color: colors.muted,
  },
  close: {
    height: 52,
    marginTop: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
});
