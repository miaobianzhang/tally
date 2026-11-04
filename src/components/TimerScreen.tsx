import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDayKey } from '../hooks/useDayKey';
import { useTally } from '../hooks/useTally';
import { colors, spacing } from '../theme';
import {
  formatClockTime,
  formatDateLabel,
  formatElapsed,
} from '../utils/time';
import { TimerButton } from './TimerButton';

export function TimerScreen() {
  const { hydrated, busy, timer, elapsedMs, start, stop } = useTally();
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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Tally</Text>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.page,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.text,
  },
  date: {
    fontSize: 13,
    color: colors.muted,
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
    color: colors.textSecondary,
  },
  timer: {
    fontWeight: '300',
    letterSpacing: 1,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.muted,
  },
  prefill: {
    marginTop: spacing.sm,
    maxWidth: '86%',
    fontSize: 12,
    color: colors.textSecondary,
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
