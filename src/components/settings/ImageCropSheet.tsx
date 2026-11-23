import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PinchGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect } from 'react-native-svg';

import { radius, spacing } from '../../theme';
import {
  clampTransform,
  computeSourceCrop,
  coverScale,
  type CropTransform,
} from '../../utils/crop';
import {
  cropImageToCache,
  type CropSource,
} from '../../utils/imageStorage';

const MAX_ZOOM = 5;

interface ImageCropSheetProps {
  source: CropSource;
  kind: 'avatar' | 'background';
  onCancel: () => void;
  onCropped: (cacheUri: string) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ImageCropSheet({
  source,
  kind,
  onCancel,
  onCropped,
}: ImageCropSheetProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [busy, setBusy] = useState(false);

  const isAvatar = kind === 'avatar';
  const aspect = isAvatar
    ? 1
    : Math.max(0.35, window.width / window.height);
  const maxFrameHeight = Math.max(180, window.height - 230);
  let frameHeight = isAvatar
    ? Math.min(window.width - 48, maxFrameHeight, 360)
    : Math.min(maxFrameHeight, 560);
  let frameWidth = isAvatar ? frameHeight : frameHeight * aspect;
  if (frameWidth > window.width - 32) {
    frameWidth = window.width - 32;
    frameHeight = frameWidth / aspect;
  }
  const frame = { width: frameWidth, height: frameHeight };

  const baseScale = coverScale(source, frame);
  const baseWidth = source.width * baseScale;
  const baseHeight = source.height * baseScale;
  const left = (frame.width - baseWidth) / 2;
  const top = (frame.height - baseHeight) / 2;

  const zoom = useMemo(() => new Animated.Value(1), []);
  const tx = useMemo(() => new Animated.Value(0), []);
  const ty = useMemo(() => new Animated.Value(0), []);
  const current = useRef<CropTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const panStart = useRef<CropTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const pinchStart = useRef<
    (CropTransform & { focalX: number; focalY: number }) | null
  >(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);

  const applyTransform = (next: CropTransform) => {
    const safe = clampTransform(source, frame, next);
    current.current = safe;
    zoom.setValue(safe.zoom);
    tx.setValue(safe.offsetX);
    ty.setValue(safe.offsetY);
  };

  const handlePinchState = (
    event: PinchGestureHandlerStateChangeEvent,
  ) => {
    if (event.nativeEvent.state === State.BEGAN) {
      pinchStart.current = {
        ...current.current,
        focalX: event.nativeEvent.focalX,
        focalY: event.nativeEvent.focalY,
      };
    }
    if (
      event.nativeEvent.state === State.END ||
      event.nativeEvent.state === State.CANCELLED ||
      event.nativeEvent.state === State.FAILED
    ) {
      pinchStart.current = null;
    }
  };

  const handlePinch = (event: PinchGestureHandlerGestureEvent) => {
    const start = pinchStart.current;
    if (!start) return;
    const scale = event.nativeEvent.scale;
    const z = clamp(start.zoom * scale, 1, MAX_ZOOM);
    const ratio = z / start.zoom;
    const centerX = frame.width / 2;
    const centerY = frame.height / 2;
    const focalX = event.nativeEvent.focalX;
    const focalY = event.nativeEvent.focalY;
    applyTransform({
      zoom: z,
      offsetX:
        focalX - centerX - ratio * (start.focalX - centerX - start.offsetX),
      offsetY:
        focalY - centerY - ratio * (start.focalY - centerY - start.offsetY),
    });
  };

  const handlePanState = (event: PanGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      panStart.current = { ...current.current };
    }
  };

  const handlePan = (event: PanGestureHandlerGestureEvent) => {
    applyTransform({
      zoom: current.current.zoom,
      offsetX: panStart.current.offsetX + event.nativeEvent.translationX,
      offsetY: panStart.current.offsetY + event.nativeEvent.translationY,
    });
  };

  const reset = () => {
    applyTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const crop = computeSourceCrop(source, frame, current.current);
      const cacheUri = await cropImageToCache(source.uri, crop, kind);
      setBusy(false);
      onCropped(cacheUri);
    } catch (error) {
      console.warn('[tally] crop failed', error);
      setBusy(false);
      Alert.alert('裁剪失败', '请换一张图片重试。');
    }
  };

  return (
    <Modal
      visible
      transparent={false}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.flex}>
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
              accessibilityLabel="取消裁剪"
              onPress={onCancel}
              style={styles.headerButton}
            >
              <Text style={styles.headerText}>取消</Text>
            </Pressable>
            <Text style={styles.title}>
              {isAvatar ? '调整头像' : '调整背景'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="使用裁剪后的图片"
              onPress={() => void handleConfirm()}
              disabled={busy}
              style={styles.headerButton}
            >
              <Text style={[styles.headerText, busy && styles.disabled]}>
                {busy ? '处理中…' : '使用'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.stage}>
            <View
              style={{
                width: frame.width,
                height: frame.height,
              }}
            >
              <PinchGestureHandler
                ref={pinchRef}
                simultaneousHandlers={panRef}
                onGestureEvent={handlePinch}
                onHandlerStateChange={handlePinchState}
              >
                <Animated.View style={styles.flex}>
                  <PanGestureHandler
                    ref={panRef}
                    minPointers={1}
                    maxPointers={1}
                    simultaneousHandlers={pinchRef}
                    onGestureEvent={handlePan}
                    onHandlerStateChange={handlePanState}
                  >
                    <View
                      style={[
                        styles.frame,
                        {
                          width: frame.width,
                          height: frame.height,
                          borderRadius: isAvatar
                            ? frame.width / 2
                            : radius.sm,
                        },
                      ]}
                    >
                      <Animated.Image
                        key={source.uri}
                        source={{ uri: source.uri }}
                        resizeMode="stretch"
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width: baseWidth,
                          height: baseHeight,
                          transform: [
                            { translateX: tx },
                            { translateY: ty },
                            { scale: zoom },
                          ],
                        }}
                      />
                    </View>
                  </PanGestureHandler>
                </Animated.View>
              </PinchGestureHandler>

              {isAvatar ? (
                <Svg
                  pointerEvents="none"
                  style={styles.guide}
                  width={frame.width}
                  height={frame.height}
                >
                  <Circle
                    cx={frame.width / 2}
                    cy={frame.height / 2}
                    r={frame.width / 2 - 1}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                </Svg>
              ) : (
                <Svg
                  pointerEvents="none"
                  style={styles.guide}
                  width={frame.width}
                  height={frame.height}
                >
                  <Rect
                    x={1}
                    y={1}
                    width={frame.width - 2}
                    height={frame.height - 2}
                    rx={radius.sm}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                </Svg>
              )}

              {busy ? (
                <View style={styles.busy}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.hint}>双指缩放 · 单指拖动</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重置缩放和位置"
            onPress={reset}
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>重置位置</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    root: {
      flex: 1,
      backgroundColor: '#0B0B0B',
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
    headerText: { fontSize: 15, color: '#FFFFFF' },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frame: {
      overflow: 'hidden',
      backgroundColor: '#1A1A1A',
    },
    guide: {
      position: 'absolute',
    },
    busy: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    hint: {
      marginTop: spacing.md,
      textAlign: 'center',
      fontSize: 13,
      color: 'rgba(255,255,255,0.72)',
    },
    resetButton: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    resetText: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.72)',
    },
    disabled: { opacity: 0.45 },
  });
