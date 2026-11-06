// Proveedor de tema: decide claro u oscuro y entrega los tokens a toda la app.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { colors, radius, spacing, typography, type ColorScheme, type ColorTokens } from './tokens';

// "system" sigue al teléfono; "light"/"dark" son la elección manual (se elige y guarda en Ajustes, HU-84).
export type ThemePreference = 'system' | ColorScheme;

export interface Theme {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

// Regla pura: separa la decisión de React para poder probarla sin renderizar nada.
export function resolveScheme(preference: ThemePreference, system: string | null | undefined): ColorScheme {
  if (preference !== 'system') {
    return preference;
  }
  // Si el sistema no informa tema, usamos oscuro: es la identidad principal de Carbon Signal.
  return system === 'light' ? 'light' : 'dark';
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  children,
  initialPreference = 'system',
  onPreferenceChange,
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
  /** Avisa la elección del usuario para guardarla (el proveedor no sabe nada de almacenamiento). */
  onPreferenceChange?: (preference: ThemePreference) => void;
}) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const scheme = resolveScheme(preference, system);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      onPreferenceChange?.(next);
    },
    [onPreferenceChange],
  );

  // useMemo evita crear un objeto nuevo en cada render, que re-renderizaría toda la app.
  const theme = useMemo<Theme>(
    () => ({ scheme, colors: colors[scheme], spacing, radius, typography, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    // Error de programación: un componente se usó fuera del proveedor.
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return theme;
}
