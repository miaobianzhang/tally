import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getBackgroundPreset } from '../theme/presets';

import { useDayKey } from '../hooks/useDayKey';
import { useProfile } from '../hooks/useProfile';
import { useTally } from '../hooks/useTally';
import { useTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { ThemeColors } from '../theme/types';
import { spacing } from '../theme';
import {
  formatClockTime,
  formatDateLabel,
  formatElapsed,
} from '../utils/time';
import { UserAvatar } from './settings/UserAvatar';
import { TimerButton } from './TimerButton';

export function TimerScreen() {
  const { colors, background } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hydrated, busy, timer, elapsedMs, start, stop } = useTally();
  const { profile } = useProfile();
  const now = useDayKey();
  const { width } = useWindowDimensions();

  const isRunning = timer.status === 'running';
  const isPending = timer.status === 'pending';
  const statusLabel = isRunning
    ? '计时中'
    : isPending
      ? '等待记录'
      : '准备开始';
  const buttonDisabled = !hydrated || busy || isPending;
  const timerFontSize = Math.min(72, Math.max(48, width * 0.185));
  const preset = getBackgroundPreset(background.presetId);
  const hasCustomBackground =
    background.kind === 'preset' || background.kind === 'image';
  const scrimOpacity =
    typeof background.scrim === 'number' ? background.scrim : 0.4;

  const handlePress = () => {
    if (isRunning) {
      void stop();
    } else {
      void start();
    }
  };

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>加载中…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, hasCustomBackground && styles.safeTransparent]}
      edges={['top', 'left', 'right']}
    >
      {background.kind === 'preset' && preset ? (
        <LinearGradient
          colors={colors.isDark ? preset.dark : preset.light}
          style={styles.backgroundLayer}
        />
      ) : null}
      {background.kind === 'image' && background.imageUri ? (
        <Image
          source={{ uri: background.imageUri }}
          style={styles.backgroundLayer}
          resizeMode="cover"
        />
      ) : null}
      {hasCustomBackground ? (
        <View
          pointerEvents="none"
          style={[
            styles.backgroundLayer,
            {
              backgroundColor: colors.isDark ? '#000000' : colors.page,
              opacity: background.kind === 'image'
                ? (colors.isDark ? 0.55 : 0.72)
                : scrimOpacity * 0.35,
            },
          ]}
        />
      ) : null}
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <UserAvatar
              uri={profile.avatarUri}
              displayName={profile.displayName}
              accessibilityLabel={`打开设置，${profile.displayName}`}
              onPress={() => router.push('/settings')}
            />
            <Text style={styles.wordmark}>Tally</Text>
          </View>
          <Text style={styles.date}>{formatDateLabel(now)}</Text>
        </View>

        <View style={styles.timerArea}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isRunning && styles.statusDotActive,
                isPending && styles.statusDotActive,
              ]}
            />
            <Text style={styles.status}>{statusLabel}</Text>
          </View>

          <Text
            accessibilityLabel={`已计时 ${formatElapsed(elapsedMs)}`}
            numberOfLines={1}
            style={[styles.timer, { fontSize: timerFontSize }]}
          >
            {formatElapsed(elapsedMs)}
          </Text>

          <Text style={styles.hint}>
            {isRunning
              ? `开始于 ${formatClockTime(timer.startedAt)}`
              : isPending
                ? '完成后记录这段时间'
                : '准备好后开始'}
          </Text>

          {timer.status !== 'idle' && timer.prefill ? (
            <Text numberOfLines={1} style={styles.prefill}>
              来自计划：{timer.prefill.activity}
            </Text>
          ) : null}
        </View>

        <TimerButton
          status={timer.status}
          startedAt={isRunning ? timer.startedAt : undefined}
          disabled={buttonDisabled}
          onPress={handlePress}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.page,
  },
  safeTransparent: {
    backgroundColor: 'transparent',
  },
  backgroundLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.textOnPage,
  },
  date: {
    fontSize: 13,
    color: colors.mutedOnPage,
  },
  timerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
  },
  statusDotActive: {
    backgroundColor: colors.running,
  },
  status: {
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.textSecondaryOnPage,
  },
  timer: {
    fontWeight: '300',
    letterSpacing: 1,
    color: colors.textOnPage,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.mutedOnPage,
  },
  prefill: {
    marginTop: spacing.sm,
    maxWidth: '86%',
    fontSize: 12,
    color: colors.textSecondaryOnPage,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
});
