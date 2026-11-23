import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_COLOR_PALETTE } from '../../constants/categories';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';
import { radius, spacing } from '../../theme';
import { isHexColor } from '../../utils/categoryValidation';
import { hexToHsv, hsvToHex } from '../../utils/colorPicker';
import { HorizontalSlider } from './HorizontalSlider';

const HUE_COLORS = [
  '#FF0000',
  '#FFFF00',
  '#00FF00',
  '#00FFFF',
  '#0000FF',
  '#FF00FF',
  '#FF0000',
] as const;

const PAD_HEIGHT = 180;
const THUMB = 22;

interface ColorChoiceSheetProps {
  title: string;
  value: string | null;
  fallbackColor: string;
  onSelect: (color: string | null) => void;
  onClose: () => void;
}

export function ColorChoiceSheet({
  title,
  value,
  fallbackColor,
  onSelect,
  onClose,
}: ColorChoiceSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [hsv, setHsv] = useState(() => hexToHsv(value ?? fallbackColor));
  const [hexText, setHexText] = useState(
    (value ?? fallbackColor).toUpperCase(),
  );
  const [padWidth, setPadWidth] = useState(0);
  const draftHex = hsvToHex(hsv);

  const applyHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      setHsv(next);
      setHexText(hsvToHex(next));
    },
    [],
  );

  const setPadSize = (event: LayoutChangeEvent) => {
    setPadWidth(Math.round(event.nativeEvent.layout.width));
  };

  const updatePad = useCallback(
    (x: number, y: number) => {
      if (padWidth <= 0) return;
      const s = Math.max(0, Math.min(1, x / padWidth));
      const v = Math.max(0, Math.min(1, 1 - y / PAD_HEIGHT));
      applyHsv({ h: hsv.h, s, v });
    },
    [applyHsv, hsv.h, padWidth],
  );

  const padResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) =>
          updatePad(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          ),
        onPanResponderMove: (event) =>
          updatePad(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          ),
      }),
    [updatePad],
  );

  const setHue = (ratio: number) => {
    applyHsv({
      ...hsv,
      h: Math.max(0, Math.min(1, ratio)) * 360,
    });
  };

  const handleHex = (next: string) => {
    setHexText(next);
    if (!isHexColor(next)) return;
    const parsed = hexToHsv(next);
    applyHsv({
      h: parsed.s === 0 ? hsv.h : parsed.h,
      s: parsed.s,
      v: parsed.v,
    });
  };

  const chooseSwatch = (color: string) => {
    applyHsv(hexToHsv(color));
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
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSelect(draftHex);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.applyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.applyText}>应用</Text>
              </Pressable>
            </View>

            <View
              onLayout={setPadSize}
              style={styles.pad}
              {...padResponder.panHandlers}
            >
              <View
                style={[
                  styles.padBase,
                  { backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) },
                ]}
              />
              <LinearGradient
                colors={['#FFFFFF', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.padLayer}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.padLayer}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.padThumb,
                  {
                    left: hsv.s * padWidth - THUMB / 2,
                    top: (1 - hsv.v) * PAD_HEIGHT - THUMB / 2,
                    borderColor: '#FFFFFF',
                  },
                ]}
              />
            </View>

            <View style={styles.hueRow}>
              <View style={styles.hueSlider}>
                <HorizontalSlider
                  value={hsv.h / 360}
                  min={0}
                  max={1}
                  onChange={setHue}
                  colors={HUE_COLORS}
                  accessibilityLabel="色相"
                  formatValue={(ratio) =>
                    `${Math.round(ratio * 360)}°`
                  }
                />
              </View>
              <View
                style={[
                  styles.previewSwatch,
                  { backgroundColor: draftHex },
                ]}
              />
            </View>

            <TextInput
              value={hexText}
              onChangeText={handleHex}
              onBlur={() => {
                if (!isHexColor(hexText)) setHexText(draftHex);
              }}
              autoCapitalize="characters"
              maxLength={7}
              placeholder="#2A78D6"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.subLabel}>快捷色板</Text>
            <View style={styles.swatches}>
              {CATEGORY_COLOR_PALETTE.map((color) => {
                const selected =
                  draftHex.toUpperCase() === color.toUpperCase();
                return (
                  <Pressable
                    key={color}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`颜色 ${color}`}
                    onPress={() => chooseSwatch(color)}
                    style={[
                      styles.swatch,
                      selected && styles.swatchSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.swatchFill,
                        { backgroundColor: color },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

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
          </ScrollView>
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
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { fontSize: 18, fontWeight: '600', color: colors.text },
    applyButton: {
      height: 36,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyText: { fontSize: 13, fontWeight: '600', color: colors.onAccent },
    pad: {
      height: PAD_HEIGHT,
      marginTop: spacing.lg,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    padBase: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    padLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    padThumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      borderWidth: 3,
      backgroundColor: 'transparent',
    },
    hueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    hueSlider: { flex: 1 },
    previewSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      marginTop: spacing.md,
      height: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.rangeTint,
    },
    subLabel: {
      marginTop: spacing.lg,
      fontSize: 13,
      color: colors.muted,
    },
    swatches: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: 'transparent',
      padding: 3,
    },
    swatchSelected: { borderColor: colors.text },
    swatchFill: { flex: 1, borderRadius: 14 },
    resetButton: {
      marginTop: spacing.lg,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetText: { fontSize: 14, color: colors.danger },
    pressed: { opacity: 0.7 },
  });
