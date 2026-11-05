import { contrastRatio } from './contrast';
import { resolveScheme } from './theme';
import { colors, type ColorScheme } from './tokens';

const schemes: ColorScheme[] = ['dark', 'light'];

describe('contrastRatio', () => {
  it('contrastRatio_BlackOnWhite_Returns21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('contrastRatio_SameColor_Returns1', () => {
    expect(contrastRatio('#1fc1ce', '#1fc1ce')).toBeCloseTo(1, 5);
  });

  it('contrastRatio_InvalidHex_Throws', () => {
    expect(() => contrastRatio('red', '#ffffff')).toThrow('Invalid hex color');
  });
});

// WCAG AA: 4.5:1 para texto normal. Si alguien cambia un token y rompe la legibilidad, esta prueba falla.
describe.each(schemes)('%s tokens', (scheme) => {
  const tokens = colors[scheme];

  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['muted', 'background'],
    ['muted', 'surface'],
    ['onPrimary', 'primary'],
  ] as const)('contrast_%sOn%s_MeetsWcagAa', (foreground, background) => {
    expect(contrastRatio(tokens[foreground], tokens[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['primary', 'success', 'warning', 'danger'] as const)(
    'contrast_%sOnSurface_MeetsWcagAa',
    (token) => {
      expect(contrastRatio(tokens[token], tokens.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('resolveScheme', () => {
  it('resolveScheme_ManualPreference_WinsOverSystem', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('resolveScheme_SystemPreference_FollowsDevice', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
  });

  it('resolveScheme_SystemWithoutValue_DefaultsToDark', () => {
    expect(resolveScheme('system', null)).toBe('dark');
  });
});
