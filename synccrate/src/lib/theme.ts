/** Convert a hex color like "#1ea84b" to an RGB triplet string "30 168 75" for CSS variables. */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Lighten an RGB triplet by mixing with white. factor 0..1 */
function lightenRgb(rgb: string, factor: number): string {
  const [r, g, b] = rgb.split(" ").map(Number);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `${lr} ${lg} ${lb}`;
}

const DEFAULT_ACCENT = "30 168 75";
const DEFAULT_ACCENT_LIGHT = "46 204 94";

/** Apply a game's primary color as the global accent. Pass null to reset to default. */
export function applyGameTheme(hexColor: string | null): void {
  const root = document.documentElement;
  if (!hexColor) {
    root.style.setProperty("--color-accent", DEFAULT_ACCENT);
    root.style.setProperty("--color-accent-light", DEFAULT_ACCENT_LIGHT);
    return;
  }
  const rgb = hexToRgb(hexColor);
  root.style.setProperty("--color-accent", rgb);
  root.style.setProperty("--color-accent-light", lightenRgb(rgb, 0.15));
}
