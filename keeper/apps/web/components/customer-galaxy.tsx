"use client";

// The "Customer Galaxy" — a fullscreen Obsidian-style constellation of every
// customer passport Keeper holds (22,440 of them). Each dot is one real customer;
// hover to read their passport. High-LTV customers burn brighter and cluster the
// cores. Rendered on a single <canvas> (fillRect per point) so 22k dots stay at
// 60fps; hover hit-testing uses a coarse spatial grid in CSS pixels.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "@/lib/api";

type GPoint = { i: string; n: string; c: string; s: string; l: number; o: number; k: number; r: number };
type Galaxy = {
  total: number;
  stats: {
    contactable?: number; contactable_pct?: number;
    repeat?: number; repeat_pct?: number;
    returners?: number; returners_pct?: number;
    avg_ltv?: number; segments?: Record<string, number>;
  };
  points: GPoint[];
};

const HUBS: [number, number][] = [
  [0.5, 0.46], [0.34, 0.36], [0.66, 0.39], [0.31, 0.63], [0.69, 0.61], [0.5, 0.74], [0.5, 0.27],
];

// A tiny seeded PRNG so the layout is identical every time the demo runs.
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Layout {
  n: number;
  xs: Float32Array; ys: Float32Array;
  sz: Float32Array; ph: Float32Array; al: Float32Array;
  tier: Uint8Array;
}

function buildLayout(points: GPoint[]): Layout {
  const n = points.length;
  const xs = new Float32Array(n), ys = new Float32Array(n);
  const sz = new Float32Array(n), ph = new Float32Array(n), al = new Float32Array(n);
  const tier = new Uint8Array(n);
  const rnd = mulberry(1337);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2; // ~N(0,~0.5)

  const sorted = points.map((p) => p.l).sort((a, b) => a - b);
  const p97 = sorted[Math.floor(n * 0.97)] ?? Infinity;
  const p80 = sorted[Math.floor(n * 0.8)] ?? Infinity;

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const h = HUBS[i % HUBS.length];
    const t = p.l >= p97 ? 2 : p.l >= p80 ? 1 : 0;
    tier[i] = t;
    const spread = t === 2 ? 0.05 : t === 1 ? 0.11 : 0.2;
    let x = h[0] + gauss() * spread;
    let y = h[1] + gauss() * spread * 0.86;
    if (t === 0 && rnd() < 0.16) { // a faint outer halo to fill the frame
      const a = rnd() * Math.PI * 2, r = 0.3 + rnd() * 0.2;
      x = 0.5 + Math.cos(a) * r; y = 0.5 + Math.sin(a) * r * 0.78;
    }
    xs[i] = Math.min(0.992, Math.max(0.008, x));
    ys[i] = Math.min(0.992, Math.max(0.008, y));
    sz[i] = t === 2 ? 2.6 : t === 1 ? 1.6 : 1.0;
    ph[i] = rnd() * Math.PI * 2;
    al[i] = t === 2 ? 0.95 : t === 1 ? 0.72 : 0.3 + rnd() * 0.26;
  }
  return { n, xs, ys, sz, ph, al, tier };
}

function fmtGbp(v?: number) {
  if (v == null) return "—";
  return "£" + Math.round(v).toLocaleString();
}

export function CustomerGalaxy({
  onClose, highlightId,
}: { onClose: () => void; highlightId?: string }) {
  const [data, setData] = useState<Galaxy | null>(null);
  const [err, setErr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

  // fetch the compact projection once
  useEffect(() => {
    let dead = false;
    fetch(`${API_BASE}/api/passports/galaxy`)
      .then((r) => r.json())
      .then((d: Galaxy) => { if (!dead) { if (d?.points?.length) setData(d); else setErr(true); } })
      .catch(() => !dead && setErr(true));
    return () => { dead = true; };
  }, []);

  const layout = useMemo(() => (data ? buildLayout(data.points) : null), [data]);
  const highlightIdx = useMemo(() => {
    if (!data || !highlightId) return -1;
    return data.points.findIndex((p) => p.i === highlightId);
  }, [data, highlightId]);

  // close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // the render + hit-grid loop
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0, cssW = 0, cssH = 0, dpr = 1;
    // spatial grid (CSS px) for hover hit-testing
    const CELL = 26;
    let cols = 0, rows = 0;
    let grid: number[][] = [];

    const rebuild = () => {
      const rect = wrap.getBoundingClientRect();
      cssW = Math.max(1, rect.width); cssH = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      cols = Math.ceil(cssW / CELL); rows = Math.ceil(cssH / CELL);
      grid = Array.from({ length: cols * rows }, () => [] as number[]);
      for (let i = 0; i < layout.n; i++) {
        const cx = Math.min(cols - 1, Math.floor(layout.xs[i] * cssW / CELL));
        const cy = Math.min(rows - 1, Math.floor(layout.ys[i] * cssH / CELL));
        grid[cy * cols + cx].push(i);
      }
    };
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(wrap);

    const hubColors = ["#b8860b", "#fbbf24", "#fde68a"];
    const draw = (ts: number) => {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);
      // faint hub web
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(251,191,36,0.06)";
      ctx.beginPath();
      for (let a = 0; a < HUBS.length; a++) for (let b = a + 1; b < HUBS.length; b++) {
        const dx = HUBS[a][0] - HUBS[b][0], dy = HUBS[a][1] - HUBS[b][1];
        if (dx * dx + dy * dy < 0.09) {
          ctx.moveTo(HUBS[a][0] * W, HUBS[a][1] * H);
          ctx.lineTo(HUBS[b][0] * W, HUBS[b][1] * H);
        }
      }
      ctx.stroke();

      const time = ts * 0.001;
      const { n, xs, ys, sz, ph, al, tier } = layout;
      for (let i = 0; i < n; i++) {
        const tw = 0.62 + 0.38 * Math.sin(time * 1.4 + ph[i]);
        ctx.globalAlpha = al[i] * tw;
        ctx.fillStyle = hubColors[tier[i]];
        const s = sz[i] * dpr;
        ctx.fillRect(xs[i] * W - s / 2, ys[i] * H - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // active customer — a pulsing ring + glow
      if (highlightIdx >= 0) {
        const x = xs[highlightIdx] * W, y = ys[highlightIdx] * H;
        const pr = (8 + 3 * Math.sin(time * 2.4)) * dpr;
        ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(52,211,153,0.9)"; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
        ctx.fillStyle = "#34d399"; ctx.beginPath(); ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      // hovered ring
      if (hover && hover.idx >= 0) {
        const x = xs[hover.idx] * W, y = ys[hover.idx] * H;
        ctx.beginPath(); ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(253,230,138,0.95)"; ctx.lineWidth = 1.4 * dpr; ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const cx = Math.floor(mx / CELL), cy = Math.floor(my / CELL);
      let best = -1, bestD = 14 * 14;
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          for (const idx of grid[gy * cols + gx]) {
            const dx = layout.xs[idx] * cssW - mx, dy = layout.ys[idx] * cssH - my;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = idx; }
          }
        }
      }
      setHover(best >= 0 ? { idx: best, x: mx, y: my } : null);
    };
    const onLeave = () => setHover(null);
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
    };
  }, [layout, hover, highlightIdx]);

  const hp = hover && data ? data.points[hover.idx] : null;
  const st = data?.stats;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.985, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.985, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        className="absolute inset-3 overflow-hidden rounded-2xl border border-amber-500/15 bg-[#05060a] md:inset-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* canvas field */}
        <div ref={wrapRef} className="absolute inset-0 cursor-crosshair">
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>

        {/* header */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between p-6">
          <div>
            <div className="flex items-center gap-2 text-amber-300/90">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-amber-400/40 text-[11px]">✦</span>
              <span className="text-sm font-medium uppercase tracking-[0.28em]">Customer Memory</span>
            </div>
            <p className="mt-1 text-xs text-amber-100/40">
              Every dot is one real customer passport — hover to read it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="pointer-events-auto rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
          >
            Close ✕
          </button>
        </div>

        {/* left stats panel */}
        <div className="pointer-events-none absolute left-6 top-1/2 w-[230px] -translate-y-1/2 rounded-2xl border border-amber-400/15 bg-black/40 p-5 backdrop-blur-md">
          <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/55">Total customers</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums text-amber-200">
            {data ? data.total.toLocaleString() : "—"}
          </div>
          <div className="mt-4 space-y-3 border-t border-white/5 pt-4 text-sm">
            <Row label="Repeat buyers" value={st?.repeat?.toLocaleString()} pct={st?.repeat_pct} />
            <Row label="Contactable" value={st?.contactable?.toLocaleString()} pct={st?.contactable_pct} />
            <Row label="Have returned" value={st?.returners?.toLocaleString()} pct={st?.returners_pct} />
            <Row label="Avg lifetime value" value={fmtGbp(st?.avg_ltv)} />
          </div>
          {highlightIdx >= 0 && data && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-[11px] text-mint-400">
              <span className="h-2 w-2 rounded-full bg-mint-400" />
              {data.points[highlightIdx].n.split(" ")[0]} is in here
            </div>
          )}
        </div>

        {/* loading / error */}
        {!data && !err && (
          <div className="absolute inset-0 grid place-items-center text-amber-200/50">
            Loading {`{`}22,440{`}`} passports…
          </div>
        )}
        {err && (
          <div className="absolute inset-0 grid place-items-center text-amber-300/70">
            Passport memory unavailable — is the API on :8000?
          </div>
        )}

        {/* hover passport card */}
        {hp && hover && (
          <div
            className="pointer-events-none absolute z-10 w-[210px] rounded-xl border border-amber-400/25 bg-black/80 p-3.5 text-xs shadow-2xl backdrop-blur-md"
            style={{
              left: Math.min(hover.x + 16, (wrapRef.current?.clientWidth ?? 0) - 226),
              top: Math.min(hover.y + 16, (wrapRef.current?.clientHeight ?? 0) - 150),
            }}
          >
            <div className="text-sm font-semibold text-amber-100">{hp.n}</div>
            <div className="mt-0.5 text-amber-200/45">{hp.c} · {hp.s}</div>
            <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-amber-100/70">
              <span className="text-amber-200/40">Lifetime</span><span className="text-right tabular-nums">{fmtGbp(hp.l)}</span>
              <span className="text-amber-200/40">Orders</span><span className="text-right tabular-nums">{hp.o}</span>
              <span className="text-amber-200/40">Sizes kept</span><span className="text-right tabular-nums">{hp.k}</span>
              <span className="text-amber-200/40">Returned</span><span className="text-right tabular-nums">{hp.r}</span>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value, pct }: { label: string; value?: string; pct?: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="tabular-nums text-amber-100/90">{value ?? "—"}</span>
        {pct != null && <span className="text-[10px] tabular-nums text-amber-300/50">{pct}%</span>}
      </span>
    </div>
  );
}
