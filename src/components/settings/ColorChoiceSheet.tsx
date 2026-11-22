import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_COLOR_PALETTE } from '../../constants/categories';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';
import { radius, spacing } from '../../theme';
import { isHexColor } from '../../utils/categoryValidation';

interface ColorChoiceSheetProps {
  title: string;
  value: string | null;
  onSelect: (color: string | null) => void;
  onClose: () => void;
}

export function ColorChoiceSheet({
  title,
  value,
  onSelect,
  onClose,
}: ColorChoiceSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [hex, setHex] = useState(value ?? '');

  const handleHex = (next: string) => {
    setHex(next);
    if (isHexColor(next)) {
      onSelect(next.toUpperCase());
      onClose();
    }
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
          accessibilityLabel="关闭颜色选择"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.xl) },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <View style={styles.swatches}>
            {CATEGORY_COLOR_PALETTE.map((color) => {
              const selected =
                value?.toUpperCase() === color.toUpperCase();
              return (
                <Pressable
                  key={color}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`颜色 ${color}`}
                  onPress={() => {
                    onSelect(color);
                    onClose();
                  }}
                  style={[
                    styles.swatch,
                    selected && styles.swatchSelected,
                  ]}
                >
                  <View
                    style={[styles.swatchFill, { backgroundColor: color }]}
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
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onSelect(null);
              onClose();
            }}
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resetText}>恢复默认颜色</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    title: { fontSize: 18, fontWeight: '600', color: colors.text },
    swatches: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 3,
    },
    swatchSelected: { borderColor: colors.text },
    swatchFill: { flex: 1, borderRadius: 16 },
    input: {
      marginTop: spacing.lg,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.rangeTint,
    },
    resetButton: {
      marginTop: spacing.md,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetText: { fontSize: 14, color: colors.textSecondary },
    pressed: { opacity: 0.7 },
  });
