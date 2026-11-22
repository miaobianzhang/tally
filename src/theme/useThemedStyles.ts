import { useMemo } from 'react';

import { useTheme } from './ThemeProvider';
import type { ThemeColors } from './types';

export function useThemedStyles<T>(
  factory: (colors: ThemeColors) => T,
): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
