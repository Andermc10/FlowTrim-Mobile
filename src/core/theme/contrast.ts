// Cálculo de contraste WCAG 2.x entre dos colores hexadecimales (#rrggbb).
// Función pura: se usa en pruebas para garantizar que los tokens de texto se leen bien.

// Convierte un canal sRGB (0-255) a luminancia lineal, según la fórmula de WCAG.
function toLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

// Luminancia relativa: el ojo percibe más el verde que el rojo y el azul, por eso los pesos.
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => toLinear(parseInt(part ?? '0', 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

// Razón de contraste: 1 (igual) a 21 (negro sobre blanco). AA exige ≥ 4.5 para texto normal.
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}
