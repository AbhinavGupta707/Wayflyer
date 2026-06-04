// Shared formatting helpers — keep money consistent across every workstream.

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const GBP_PENCE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("en-GB");

/** £305,692 — whole-pound, for hero counters and axes. */
export function gbp(value: number): string {
  return GBP.format(value || 0);
}

/** £87.62 — to the penny, for per-case economics. */
export function gbpPence(value: number): string {
  return GBP_PENCE.format(value || 0);
}

/** 1,382 — thousands-separated integers. */
export function num(value: number): string {
  return NUM.format(Math.round(value || 0));
}

/** 0.562 → "56%". */
export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** "2024-06" → "Jun '24" for compact month axes. */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${months[idx]} '${y.slice(2)}`;
}
