import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { DEFAULT_IMAGE_OPACITY, getBackgroundPreset } from '../theme/presets';
import type { BackgroundPref } from '../theme/types';

interface HomeBackgroundProps {
  background: BackgroundPref;
}

export function HomeBackground({ background }: HomeBackgroundProps) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const preset = getBackgroundPreset(background.presetId);
  const imageOpacity = Math.max(
    0.15,
    Math.min(1, background.imageOpacity ?? DEFAULT_IMAGE_OPACITY),
  );
  const scrim = Math.max(
    0.2,
    Math.min(0.6, background.scrim ?? 0.4),
  );
  const showImage =
    background.kind === 'image' &&
    Boolean(background.imageUri) &&
    failedUri !== background.imageUri;

  return (
    <View pointerEvents="none" style={styles.layer}>
      {background.kind === 'preset' && preset ? (
        <LinearGradient
          colors={colors.isDark ? preset.dark : preset.light}
          style={styles.layer}
        />
      ) : null}

      {showImage && background.imageUri ? (
        <Image
          key={background.imageUri}
          source={{ uri: background.imageUri }}
          resizeMode="cover"
          onError={() => setFailedUri(background.imageUri ?? null)}
          style={[styles.layer, { opacity: imageOpacity }]}
        />
      ) : null}

      {background.kind === 'image' ? (
        <View
          style={[
            styles.layer,
            {
              backgroundColor: colors.page,
              opacity: scrim,
            },
          ]}
        />
      ) : null}

      {background.kind === 'preset' ? (
        <View
          style={[
            styles.layer,
            {
              backgroundColor: colors.isDark ? '#000000' : colors.page,
              opacity: scrim * 0.35,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
