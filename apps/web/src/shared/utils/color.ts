/** Luminância relativa (WCAG) de uma cor "#RRGGBB" ou "RRGGBB", de 0 (preto) a 1 (branco). */
export function relativeLuminance(color: string): number {
  const hex = color.replace('#', '');
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** Preto ou branco, o que tiver mais contraste com o fundo (luminância relativa WCAG). */
export function readableTextColor(background: string): '#000000' | '#FFFFFF' {
  const luminance = relativeLuminance(background);
  // Contraste com branco (1.05 / (L + 0.05)) contra preto ((L + 0.05) / 0.05).
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#FFFFFF' : '#000000';
}

/** Cor tão clara que some sobre fundo branco (ex.: amarelo de linha); pede contorno. */
export function isVeryLight(color: string): boolean {
  return relativeLuminance(color) > 0.8;
}

/** "509e2f" ou "#509e2f" vira "#509E2F"; vazio ou inválido vira null. */
export function toHexColor(color: string | null | undefined): string | null {
  if (!color) return null;
  const hex = color.replace('#', '');
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}
