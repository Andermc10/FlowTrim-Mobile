// Tokens de diseño Carbon Signal: los mismos valores que `FlowTrim-frontend/src/styles.scss`,
// para que la app móvil y la web se vean como un solo producto.

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceSoft: string;
  text: string;
  muted: string;
  border: string;
  borderStrong: string;
  primary: string;
  /** Texto sobre un fondo `primary` (botones). Nunca usar un color fijo en su lugar. */
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
}

export const colors: Record<ColorScheme, ColorTokens> = {
  dark: {
    background: '#070b0d',
    surface: '#101a1e',
    surfaceSoft: '#0d171a',
    text: '#f2f7f5',
    muted: '#8ba0a6',
    border: '#203036',
    borderStrong: '#315058',
    primary: '#1fc1ce',
    onPrimary: '#061014',
    success: '#00c483',
    warning: '#ffb547',
    danger: '#ff6b6b',
  },
  light: {
    background: '#f3f7f6',
    surface: '#ffffff',
    surfaceSoft: '#edf4f3',
    text: '#102023',
    muted: '#607277',
    border: '#d6e2e0',
    borderStrong: '#a8c1be',
    primary: '#077a84',
    onPrimary: '#ffffff',
    // Más oscuro que la web (#008f61 da 4.12:1 sobre blanco y no cumple WCAG AA).
    success: '#007f55',
    warning: '#a86400',
    danger: '#c63d47',
  },
};

// Espaciado en múltiplos de 4 dp: ritmo visual constante entre pantallas.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

// Escala tipográfica; la fuente es la del sistema (Space Grotesk llega con la identidad final de HU-91).
export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 15, lineHeight: 22 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
} as const;

// Tamaño mínimo de cualquier zona táctil (WCAG 2.5.8 / Material): 44 dp.
export const minTouchTarget = 44;
