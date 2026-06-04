// Map a Pretty Fly colourway name to a swatch colour (no product images in the
// dataset, so we render elegant monochrome cards with a real colour chip).

const MAP: Record<string, string> = {
  "Washed Black": "#2b2b2e", "Black": "#16161a", "Charcoal": "#3a3f44", "Slate": "#4b5563",
  "Off-White": "#ece7df", "White": "#f5f5f4", "Bone": "#e7e0d3", "Ecru": "#dcd3c3", "Cream": "#efe7d6",
  "Sage": "#9caa8e", "Olive": "#6b7257", "Forest": "#3c4a3a", "Stone": "#a8a29e", "Sand": "#cbb892",
  "Navy": "#27324a", "Cobalt": "#2b4a8b", "Sky": "#7aa7d8", "Burgundy": "#5b2333", "Rust": "#9c5a3c",
  "Grey": "#8b8b8f", "Heather Grey": "#9aa0a6", "Tan": "#b79b73", "Mocha": "#6f5746",
};

export function swatch(colour: string): string {
  if (MAP[colour]) return MAP[colour];
  let h = 0;
  for (const ch of colour) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 16% 46%)`;
}
