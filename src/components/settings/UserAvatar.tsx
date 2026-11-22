import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { ThemeColors } from '../../theme/types';

interface UserAvatarProps {
  uri: string | null;
  displayName: string;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function UserAvatar({
  uri,
  displayName,
  size = 40,
  onPress,
  accessibilityLabel = '打开设置',
}: UserAvatarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const initial = displayName.trim().slice(0, 1) || 'T';
  const showImage = Boolean(uri) && failedUri !== uri;

  const content = (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {showImage && uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <View style={styles.fallback}>
          <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24">
            <Circle cx={12} cy={8} r={4} fill={colors.muted} />
            <Path
              d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"
              fill="none"
              stroke={colors.muted}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.initial}>{initial}</Text>
        </View>
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    circle: {
      overflow: 'hidden',
      backgroundColor: colors.rangeTint,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: {
      position: 'absolute',
      bottom: -1,
      right: 2,
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    pressed: { opacity: 0.7 },
  });
