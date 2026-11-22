import type { AppearancePrefs, ThemeColors } from './types';
import { DARK_BASE, LIGHT_BASE } from './presets';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function normalizeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value)
    ? value.toUpperCase()
    : fallback;
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = normalizeHex(hex, '#000000').slice(1);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function mixHex(from: string, to: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t,
  );
}

export function relativeLuminance(hex: string): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickReadableText(background: string): string {
  const dark = '#0B0B0B';
  const light = '#F5F5F2';
  return contrastRatio(background, dark) >= contrastRatio(background, light)
    ? dark
    : light;
}

export function resolveScheme(
  mode: AppearancePrefs['mode'],
  systemScheme: 'light' | 'dark' | null | undefined,
): 'light' | 'dark' {
  if (mode === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return mode;
}

export function buildThemeColors(
  prefs: AppearancePrefs,
  systemScheme: 'light' | 'dark' | null | undefined,
): ThemeColors {
  const scheme = resolveScheme(prefs.mode, systemScheme);
  const base = scheme === 'dark' ? DARK_BASE : LIGHT_BASE;
  const page = normalizeHex(prefs.pageColor, base.page);
  const surface = normalizeHex(prefs.surfaceColor, base.surface);
  const accent = normalizeHex(prefs.accentColor, base.accent);
  const text = pickReadableText(surface);
  const textOnPage = pickReadableText(page);

  return {
    page,
    surface,
    surfaceOpaque: surface,
    text,
    textOnPage,
    textSecondary: mixHex(text, surface, 0.25),
    textSecondaryOnPage: mixHex(textOnPage, page, 0.25),
    muted: mixHex(text, surface, 0.45),
    mutedOnPage: mixHex(textOnPage, page, 0.45),
    border: mixHex(surface, text, 0.12),
    axis: mixHex(surface, text, 0.28),
    rangeTint: mixHex(surface, accent, 0.08),
    accent,
    onAccent: pickReadableText(accent),
    danger: scheme === 'dark' ? '#ff7b72' : '#d03b3b',
    running: scheme === 'dark' ? '#ff8a5c' : '#eb6834',
    overlay:
      scheme === 'dark' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(11, 11, 11, 0.35)',
    isDark: scheme === 'dark',
  };
}
