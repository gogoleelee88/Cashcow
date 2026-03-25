// Shared UI tokens and design system constants
// Components are in apps/web/src/components for Next.js specific,
// and apps/mobile/src/components for React Native specific

export const colors = {
  // Primary brand - deep purple/violet (crack.wrtn.ai inspired)
  brand: {
    50: '#f0ebff',
    100: '#ddd6fe',
    200: '#c4b5fd',
    300: '#a78bfa',
    400: '#8b5cf6',
    500: '#7c3aed',
    600: '#6d28d9',
    700: '#5b21b6',
    800: '#4c1d95',
    900: '#2e1065',
  },
  // Dark backgrounds
  dark: {
    950: '#08060e',
    900: '#0d0b14',
    850: '#11101a',
    800: '#161422',
    750: '#1a1828',
    700: '#1e1c2e',
    650: '#221f34',
    600: '#2a273f',
    500: '#32304d',
    400: '#3d3a5c',
    300: '#4a476e',
  },
  // Accent colors
  accent: {
    pink: '#e879f9',
    cyan: '#22d3ee',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#fb7185',
  },
  // Text
  text: {
    primary: '#f0ecff',
    secondary: '#a9a4c9',
    muted: '#6b6789',
    disabled: '#3d3a5c',
  },
  // Status
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#f43f5e',
    info: '#3b82f6',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  fontFamily: {
    sans: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.4)',
  md: '0 4px 12px rgba(0,0,0,0.5)',
  lg: '0 8px 24px rgba(0,0,0,0.6)',
  glow: {
    purple: '0 0 20px rgba(124,58,237,0.4)',
    pink: '0 0 20px rgba(232,121,249,0.4)',
    cyan: '0 0 20px rgba(34,211,238,0.4)',
  },
} as const;
