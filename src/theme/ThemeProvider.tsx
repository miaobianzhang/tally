import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  loadAppearance,
  normalizeAppearancePrefs,
  saveAppearance,
} from '../storage/preferencesStorage';
import { buildThemeColors } from './derive';
import { DEFAULT_APPEARANCE } from './presets';
import type {
  AppearancePrefs,
  BackgroundPref,
  ThemeMode,
  ThemeValue,
} from './types';

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [prefs, setPrefs] = useState<AppearancePrefs>({
    ...DEFAULT_APPEARANCE,
  });
  const prefsRef = useRef(prefs);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadAppearance().catch(() => null);
      if (cancelled) return;
      if (loaded) setPrefs(loaded);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback(
    async (next: AppearancePrefs): Promise<boolean> => {
      const previous = prefsRef.current;
      const normalized = normalizeAppearancePrefs(next);
      prefsRef.current = normalized;
      setPrefs(normalized);
      try {
        const saved = await saveAppearance(normalized);
        prefsRef.current = saved;
        setPrefs(saved);
        return true;
      } catch (error) {
        console.warn('[tally] failed to save appearance', error);
        prefsRef.current = previous;
        setPrefs(previous);
        return false;
      }
    },
    [],
  );

  const setMode = useCallback(
    (mode: ThemeMode) =>
      commit({ ...prefsRef.current, mode, updatedAt: Date.now() }),
    [commit],
  );

  const setColor = useCallback(
    (
      key: 'pageColor' | 'surfaceColor' | 'accentColor',
      color: string | null,
    ) =>
      commit({
        ...prefsRef.current,
        [key]: color,
        updatedAt: Date.now(),
      }),
    [commit],
  );

  const setBackground = useCallback(
    (background: BackgroundPref) =>
      commit({
        ...prefsRef.current,
        background,
        updatedAt: Date.now(),
      }),
    [commit],
  );

  const resetAppearance = useCallback(() => {
    const current = prefsRef.current.background;
    return commit({
      ...DEFAULT_APPEARANCE,
      background: {
        ...DEFAULT_APPEARANCE.background,
        imageUri: current.imageUri,
        imageOpacity: current.imageOpacity,
        scrim: current.scrim,
      },
      updatedAt: Date.now(),
    });
  }, [commit]);

  const colors = useMemo(
    () => buildThemeColors(prefs, systemScheme),
    [prefs, systemScheme],
  );

  const value = useMemo<ThemeValue>(
    () => ({
      colors,
      mode: colors.isDark ? 'dark' : 'light',
      prefs,
      background: prefs.background,
      setMode,
      setColor,
      setBackground,
      resetAppearance,
      hydrated,
    }),
    [
      colors,
      prefs,
      setMode,
      setColor,
      setBackground,
      resetAppearance,
      hydrated,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return value;
}
