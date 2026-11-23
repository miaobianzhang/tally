import type { ReactNode } from 'react';
import Animated, { LinearTransition } from 'react-native-reanimated';

interface AnimatedReorderRowProps {
  children: ReactNode;
  reduceMotion: boolean;
}

export function AnimatedReorderRow({
  children,
  reduceMotion,
}: AnimatedReorderRowProps) {
  return (
    <Animated.View
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.duration(220)
      }
    >
      {children}
    </Animated.View>
  );
}
