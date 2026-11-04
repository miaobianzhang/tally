import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES } from '../constants/categories';
import { colors, radius, spacing } from '../theme';
import type { CategoryId } from '../types';

interface CategoryPickerProps {
  value: CategoryId;
  onChange: (value: CategoryId) => void;
  disabled?: boolean;
}

export function CategoryPicker({
  value,
  onChange,
  disabled = false,
}: CategoryPickerProps) {
  return (
    <View style={styles.chips}>
      {CATEGORIES.map((item) => {
        const selected = item.id === value;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`分类 ${item.label}`}
            disabled={disabled}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              disabled && styles.chipDisabled,
              pressed && !disabled && styles.pressed,
            ]}
          >
            <View
              style={[styles.chipDot, { backgroundColor: item.color }]}
            />
            <Text
              style={[
                styles.chipText,
                selected && styles.chipTextSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.onAccent,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.75,
  },
});
