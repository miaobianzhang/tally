import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAN_SECTION_LABELS } from '../constants/plans';
import { usePlans } from '../hooks/usePlans';
import { colors, radius, spacing } from '../theme';
import { PLAN_SECTIONS, type PlanSection } from '../types';
import { hapticSelection } from '../utils/haptics';

interface PlanSettingsSheetProps {
  onClose: () => void;
}

export function PlanSettingsSheet({ onClose }: PlanSettingsSheetProps) {
  const { prefs, busy, setSectionVisible, moveSectionTo } = usePlans();
  const insets = useSafeAreaInsets();

  const toggle = async (section: PlanSection, visible: boolean) => {
    const saved = await setSectionVisible(section, visible);
    if (!saved) {
      Alert.alert('保存失败', '设置没有保存，请重试。');
    }
  };

  const move = async (section: PlanSection, targetIndex: number) => {
    const saved = await moveSectionTo(section, targetIndex);
    if (saved) {
      hapticSelection();
    } else {
      Alert.alert('保存失败', '顺序没有保存，请重试。');
    }
  };

  const rows: {
    section: PlanSection;
    label: string;
    value: boolean;
  }[] = [
    { section: 'week', label: '显示周计划', value: prefs.showWeek },
    { section: 'month', label: '显示月计划', value: prefs.showMonth },
    {
      section: 'deadline',
      label: '显示 Deadline',
      value: prefs.showDeadlines,
    },
  ];

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
          accessibilityLabel="关闭计划设置"
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
            <Text style={styles.title}>计划设置</Text>
            <Text style={styles.subtitle}>
              隐藏只会影响计划页显示，不会删除计划。数字 1–3
              决定区块从上到下的顺序。
            </Text>

            <View style={styles.settings}>
              {rows.map((row) => (
                <View key={row.section} style={styles.settingRow}>
                  <Text style={styles.settingLabel}>{row.label}</Text>
                  <Switch
                    accessibilityLabel={row.label}
                    value={row.value}
                    disabled={busy}
                    onValueChange={(value) => {
                      void toggle(row.section, value);
                    }}
                    trackColor={{
                      false: colors.border,
                      true: colors.text,
                    }}
                    thumbColor={colors.surface}
                    ios_backgroundColor={colors.border}
                  />
                </View>
              ))}
            </View>

            <View style={styles.orderSection}>
              <Text style={styles.orderTitle}>区块顺序</Text>
              <Text style={styles.orderHint}>
                数字表示计划页中从上到下的位置。
              </Text>

              {PLAN_SECTIONS.map((section) => {
                const position = prefs.sectionOrder.indexOf(section);
                return (
                  <View key={section} style={styles.orderRow}>
                    <Text style={styles.orderLabel}>
                      {PLAN_SECTION_LABELS[section]}
                    </Text>
                    <View style={styles.positionGroup}>
                      {[0, 1, 2].map((index) => {
                        const selected = position === index;
                        return (
                          <Pressable
                            key={index}
                            accessibilityRole="radio"
                            accessibilityState={{
                              selected,
                              disabled: busy,
                            }}
                            accessibilityLabel={`把${PLAN_SECTION_LABELS[section]}设为第 ${index + 1} 位`}
                            disabled={busy}
                            onPress={() => {
                              void move(section, index);
                            }}
                            style={({ pressed }) => [
                              styles.positionButton,
                              selected &&
                                styles.positionButtonSelected,
                              pressed &&
                                !busy &&
                                styles.pressed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.positionText,
                                selected &&
                                  styles.positionTextSelected,
                              ]}
                            >
                              {index + 1}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="完成计划设置"
              onPress={onClose}
              style={({ pressed }) => [
                styles.done,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.doneText}>完成</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
    lineHeight: 19,
    color: colors.muted,
  },
  settings: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  settingRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    fontSize: 15,
    color: colors.text,
  },
  orderSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  orderTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  orderHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  orderRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  orderLabel: {
    fontSize: 15,
    color: colors.text,
  },
  positionGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  positionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  positionText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textSecondary,
  },
  positionTextSelected: {
    color: colors.onAccent,
  },
  done: {
    height: 52,
    marginTop: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
});
