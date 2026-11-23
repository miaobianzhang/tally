import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_COLOR_PALETTE } from '../../constants/categories';
import { useCategories } from '../../hooks/useCategories';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';
import { radius, spacing } from '../../theme';
import type { CategoryDefinition } from '../../types';
import { isHexColor } from '../../utils/categoryValidation';
import { hapticSelection } from '../../utils/haptics';

interface CategoryEditorSheetProps {
  category: CategoryDefinition | null;
  onClose: () => void;
}

export function CategoryEditorSheet({
  category,
  onClose,
}: CategoryEditorSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const {
    addCategory,
    updateCategory,
    archiveCategory,
    restoreCategory,
    deleteCategory,
    busy,
  } = useCategories();
  const [label, setLabel] = useState(category?.label ?? '');
  const [color, setColor] = useState(
    category?.color ?? CATEGORY_COLOR_PALETTE[0],
  );
  const [hex, setHex] = useState(color);
  const [countsAsFocus, setCountsAsFocus] = useState(
    category?.countsAsFocus ?? false,
  );

  const chooseColor = (value: string) => {
    setColor(value);
    setHex(value);
    hapticSelection();
  };

  const handleHex = (value: string) => {
    setHex(value);
    if (isHexColor(value)) setColor(value.toUpperCase());
  };

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      Alert.alert('请填写分类名称');
      return;
    }
    if (!isHexColor(color)) {
      Alert.alert('颜色格式不正确', '请输入形如 #2A78D6 的六位十六进制颜色。');
      return;
    }
    const saved = category
      ? await updateCategory(category.id, {
          label: trimmed,
          color,
          countsAsFocus,
        })
      : await addCategory({ label: trimmed, color, countsAsFocus });
    if (!saved) {
      Alert.alert('保存失败', '分类名称可能重复，或请稍后重试。');
      return;
    }
    hapticSelection();
    onClose();
  };

  const handleDelete = () => {
    if (!category || busy) return;
    Alert.alert(
      '删除分类',
      `确定删除「${category.label}」？删除后它不会再出现在分类列表和选择器中，已有记录仍保留原分类名称和颜色。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void deleteCategory(category.id).then((ok) => {
              if (ok) {
                hapticSelection();
                onClose();
              } else {
                Alert.alert(
                  '无法删除',
                  '至少需要保留一个可用分类。',
                );
              }
            });
          },
        },
      ],
    );
  };

  const handleArchiveToggle = () => {
    if (!category) return;
    if (category.archived) {
      void restoreCategory(category.id).then((ok) => {
        if (ok) {
          hapticSelection();
          onClose();
        } else {
          Alert.alert('恢复失败', '请重试。');
        }
      });
      return;
    }
    Alert.alert(
      '停用分类',
      '停用后该分类会从计时和计划选择器中隐藏，历史记录保留，可随时恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '停用',
          style: 'destructive',
          onPress: () => {
            void archiveCategory(category.id).then((ok) => {
              if (ok) {
                hapticSelection();
                onClose();
              } else {
                Alert.alert('无法停用', '至少需要保留一个可用分类。');
              }
            });
          },
        },
      ],
    );
  };

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
          accessibilityLabel="关闭分类编辑"
          onPress={onClose}
          style={styles.backdrop}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.xl) },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>
              {category ? '编辑分类' : '添加分类'}
            </Text>

            <Text style={styles.label}>名称</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              maxLength={16}
              placeholder="例如：阅读"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.label}>颜色</Text>
            <View style={styles.swatches}>
              {CATEGORY_COLOR_PALETTE.map((value) => {
                const selected = color.toUpperCase() === value.toUpperCase();
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`颜色 ${value}`}
                    onPress={() => chooseColor(value)}
                    style={[
                      styles.swatch,
                      selected && styles.swatchSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.swatchFill,
                        { backgroundColor: value },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={hex}
              onChangeText={handleHex}
              autoCapitalize="characters"
              maxLength={7}
              placeholder="#2A78D6"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.hexInput]}
            />

            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>计入专注统计</Text>
                <Text style={styles.switchHint}>
                  默认的「学习 + 工作」会计入趋势图实线；自定义分类也可开启。
                </Text>
              </View>
              <Switch
                value={countsAsFocus}
                onValueChange={setCountsAsFocus}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleSave()}
              disabled={busy}
              style={({ pressed }) => [
                styles.saveButton,
                busy && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.saveText}>保存</Text>
            </Pressable>

            {category ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleArchiveToggle}
                style={({ pressed }) => [
                  styles.archiveButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.archiveText}>
                  {category.archived ? '恢复分类' : '停用分类'}
                </Text>
              </Pressable>
            ) : null}

            {category ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="删除分类"
                onPress={handleDelete}
                disabled={busy}
                style={({ pressed }) => [
                  styles.deleteButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.deleteText}>删除分类</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
    },
    sheet: {
      maxHeight: '88%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    label: {
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      fontSize: 13,
      color: colors.muted,
    },
    input: {
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.rangeTint,
    },
    hexInput: { marginTop: spacing.sm, fontSize: 14 },
    swatches: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchSelected: { borderColor: colors.text },
    swatchFill: { width: 26, height: 26, borderRadius: 13 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    switchText: { flex: 1 },
    switchTitle: { fontSize: 15, color: colors.text },
    switchHint: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 17,
      color: colors.muted,
    },
    saveButton: {
      marginTop: spacing.xl,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { fontSize: 16, fontWeight: '600', color: colors.onAccent },
    archiveButton: {
      marginTop: spacing.md,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    archiveText: { fontSize: 14, color: colors.textSecondary },
    deleteButton: {
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: { fontSize: 14, color: colors.danger },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.75 },
  });
