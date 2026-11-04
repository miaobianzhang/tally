// Neutral chrome from the dataviz reference palette.
// Category colors live in constants/categories.ts so identity stays stable.
export const colors = {
  page: '#f9f9f7',
  surface: '#fcfcfb',
  text: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  border: '#e1e0d9',
  axis: '#c3c2b7',
  rangeTint: '#efeee9',
  accent: '#0b0b0b',
  onAccent: '#ffffff',
  danger: '#d03b3b',
  running: '#eb6834',
  overlay: 'rgba(11, 11, 11, 0.35)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;
