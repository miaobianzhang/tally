import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeBackground } from '../HomeBackground';
import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';
import { radius, spacing } from '../../theme';
import { formatDateLabel } from '../../utils/time';
import {
  prepareCropSource,
  persistImage,
  type CropSource,
} from '../../utils/imageStorage';
import { deleteImageFile } from '../../utils/imageFiles';
import { HorizontalSlider } from './HorizontalSlider';
import { ImageCropSheet } from './ImageCropSheet';

interface BackgroundEditorSheetProps {
  /** Newly picked raw image. When omitted the stored image can be adjusted. */
  sourceUri?: string;
  onClose: () => void;
}

type Phase = 'preparing' | 'crop' | 'adjust';

const PREVIEW_DATE = formatDateLabel(Date.now());

export function BackgroundEditorSheet({
  sourceUri,
  onClose,
}: BackgroundEditorSheetProps) {
  const { colors, prefs, setBackground } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const existingUri = prefs.background.imageUri;
  const existingScrim = prefs.background.scrim ?? 0.4;
  const [phase, setPhase] = useState<Phase>(
    sourceUri ? 'preparing' : 'adjust',
  );
  const [prepared, setPrepared] = useState<CropSource | null>(null);
  const [tempCropUri, setTempCropUri] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(
    prefs.background.imageOpacity ?? 0.85,
  );
  const [busy, setBusy] = useState(false);
  const preparedRef = useRef<string | null>(null);
  const tempRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    if (!sourceUri) return;
    (async () => {
      try {
        const next = await prepareCropSource(sourceUri);
        if (cancelled) {
          deleteImageFile(next.uri);
          return;
        }
        preparedRef.current = next.uri;
        setPrepared(next);
        setPhase('crop');
      } catch (error) {
        console.warn('[tally] prepare background failed', error);
        if (!cancelled) {
          Alert.alert('图片读取失败', '请换一张图片重试。');
          onCloseRef.current();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceUri]);

  useEffect(
    () => () => {
      if (tempRef.current) deleteImageFile(tempRef.current);
      if (preparedRef.current) deleteImageFile(preparedRef.current);
    },
    [],
  );

  const close = () => {
    if (tempRef.current) deleteImageFile(tempRef.current);
    if (preparedRef.current) deleteImageFile(preparedRef.current);
    tempRef.current = null;
    preparedRef.current = null;
    onClose();
  };

  const handleCropped = (cacheUri: string) => {
    if (tempRef.current) deleteImageFile(tempRef.current);
    tempRef.current = cacheUri;
    setTempCropUri(cacheUri);
    setPhase('adjust');
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    let persistedUri: string | null = null;
    try {
      const finalUri = tempCropUri
        ? await persistImage(tempCropUri, 'background')
        : existingUri;
      if (!finalUri) throw new Error('没有可保存的背景');
      if (tempCropUri) persistedUri = finalUri;

      const ok = await setBackground({
        kind: 'image',
        presetId: undefined,
        imageUri: finalUri,
        imageOpacity: opacity,
        scrim: existingScrim,
      });
      if (!ok) {
        if (persistedUri) deleteImageFile(persistedUri);
        Alert.alert('保存失败', '请重试。');
        return;
      }
      if (existingUri && existingUri !== finalUri) {
        deleteImageFile(existingUri);
      }
      if (tempRef.current) deleteImageFile(tempRef.current);
      if (preparedRef.current) deleteImageFile(preparedRef.current);
      tempRef.current = null;
      preparedRef.current = null;
      onClose();
    } catch (error) {
      console.warn('[tally] background save failed', error);
      if (persistedUri) deleteImageFile(persistedUri);
      Alert.alert('保存失败', '请重试。');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'crop' && prepared) {
    return (
      <ImageCropSheet
        source={prepared}
        kind="background"
        onCancel={close}
        onCropped={handleCropped}
      />
    );
  }

  const previewUri = tempCropUri ?? existingUri;
  const aspect = Math.max(0.35, window.width / window.height);

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="取消背景调整"
            onPress={close}
            style={styles.headerButton}
          >
            <Text style={styles.headerText}>取消</Text>
          </Pressable>
          <Text style={styles.title}>背景预览</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存背景"
            disabled={busy || !previewUri}
            onPress={() => void handleSave()}
            style={styles.headerButton}
          >
            <Text
              style={[
                styles.headerText,
                (busy || !previewUri) && styles.disabled,
              ]}
            >
              {busy ? '保存中…' : '保存'}
            </Text>
          </Pressable>
        </View>

        {phase === 'preparing' || !previewUri ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.loadingText}>正在准备图片…</Text>
          </View>
        ) : (
          <>
            <View style={[styles.previewFrame, { aspectRatio: aspect }]}>
              <HomeBackground
                background={{
                  kind: 'image',
                  imageUri: previewUri,
                  imageOpacity: opacity,
                  scrim: existingScrim,
                }}
              />
              <View style={styles.previewContent}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewWordmark}>Tally</Text>
                  <Text style={styles.previewDate}>
                    {PREVIEW_DATE}
                  </Text>
                </View>
                <View style={styles.previewCenter}>
                  <Text style={styles.previewStatus}>准备开始</Text>
                  <Text style={styles.previewTimer}>00:00</Text>
                  <Text style={styles.previewHint}>准备好后开始</Text>
                </View>
                <View style={styles.previewButton}>
                  <View style={styles.previewButtonInner} />
                </View>
              </View>
            </View>

            <View style={styles.controls}>
              <Text style={styles.controlLabel}>背景图片不透明度</Text>
              <HorizontalSlider
                value={opacity}
                min={0.15}
                max={1}
                onChange={setOpacity}
                accessibilityLabel="背景图片不透明度"
                formatValue={(value) => `${Math.round(value * 100)}%`}
              />
              <View style={styles.controlMeta}>
                <Text style={styles.controlHint}>
                  向左更淡，向右更清晰
                </Text>
                <Text style={styles.controlValue}>
                  {Math.round(opacity * 100)}%
                </Text>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.page,
      paddingHorizontal: spacing.lg,
    },
    header: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerButton: {
      minWidth: 56,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { fontSize: 15, color: colors.text },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    loadingText: { fontSize: 13, color: colors.muted },
    previewFrame: {
      flex: 1,
      maxHeight: 560,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.rangeTint,
    },
    previewContent: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
      justifyContent: 'space-between',
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    previewWordmark: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textOnPage,
    },
    previewDate: { fontSize: 12, color: colors.mutedOnPage },
    previewCenter: { alignItems: 'center' },
    previewStatus: {
      fontSize: 13,
      letterSpacing: 0.5,
      color: colors.textSecondaryOnPage,
    },
    previewTimer: {
      marginTop: spacing.sm,
      fontSize: 56,
      fontWeight: '300',
      letterSpacing: 1,
      color: colors.textOnPage,
      fontVariant: ['tabular-nums'],
    },
    previewHint: {
      marginTop: spacing.sm,
      fontSize: 13,
      color: colors.mutedOnPage,
    },
    previewButton: {
      alignSelf: 'center',
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewButtonInner: {
      width: 18,
      height: 18,
      borderRadius: 4,
      backgroundColor: colors.onAccent,
    },
    controls: {
      marginTop: spacing.xl,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    controlLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    controlMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    controlHint: { fontSize: 12, color: colors.muted },
    controlValue: { fontSize: 12, color: colors.textSecondary },
    disabled: { opacity: 0.4 },
  });
