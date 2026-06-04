import { swatch } from "@/lib/colour";

// No product photos in the Pretty Fly dataset — an elegant colour-washed tile with
// an abstract garment glyph keeps the luxury layout intact. (Swap for generated
// imagery later via scripts/generate_images.)
const GLYPH: Record<string, string> = {
  Tee: "M7 4 4.5 6.5 6.5 8.5V20h11V8.5l2-2L17 4l-2.4 1.6a4 4 0 0 1-5.2 0L7 4Z",
  Hoodie: "M6.5 9 9 5a4 4 0 0 1 6 0l2.5 4-2 1.2V20H8.5v-9.8L6.5 9Z",
  Sweatpants: "M8.5 4h7l-1 16h-3.2l-1-9-1 9H7.5L6.5 4h2Z",
  Trainer: "M3.5 16.5h12l4-1.8 1.5 2.2v2h-17.5v-2.4Z",
  Cap: "M4.5 14a7.5 7.5 0 0 1 15 0v.6H4.5V14Z",
  Outerwear: "M6.5 7.5 10.5 4 12 5.6 13.5 4l4 3.5-2 1.8V20H8.5V9.3l-2-1.8Z",
};

export function ProductThumb({
  colour, productType, size, className = "",
}: { colour: string; productType: string; size?: string; className?: string }) {
  const c = swatch(colour);
  const path = GLYPH[productType] || GLYPH.Tee;
  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-xl border border-cream-200 ${className}`} style={{ background: c }}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(150deg, rgba(255,255,255,0.20), rgba(0,0,0,0.14))" }} />
      <svg viewBox="0 0 24 24" className="relative h-1/2 w-1/2 text-white/90 mix-blend-overlay" fill="currentColor">
        <path d={path} />
      </svg>
      {size && (
        <span className="absolute bottom-1 right-1.5 rounded bg-black/25 px-1 text-[9px] font-medium text-white/90">{size}</span>
      )}
    </div>
  );
}
