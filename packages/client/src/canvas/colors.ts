/**
 * Map a colorIndex (0–49) to an HSL color string.
 * Spreads across the hue wheel with good saturation and lightness.
 */
export function colorFromIndex(index: number): string {
  const hue = (index * 7.2) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export function colorFromIndexDim(index: number): string {
  const hue = (index * 7.2) % 360;
  return `hsl(${hue}, 45%, 38%)`;
}
