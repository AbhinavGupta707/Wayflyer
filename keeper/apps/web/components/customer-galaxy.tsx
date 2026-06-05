"use client";

// The "Customer Galaxy" — a fullscreen, draggable 3D constellation of every
// customer passport Keeper holds (22,440 of them). Each dot is one real customer;
// hover to read their passport, drag to orbit the cloud. High-LTV customers burn
// brighter and cluster the cores. 22k points stay at 60fps on a single <canvas>
// (additive fillRect per point, seeded layout, brute-force hover over the cached
// per-frame projection). Crucially, the render loop depends ONLY on `layout` —
// hover/highlight/rotation live in refs, so moving the mouse never restarts it.

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

// hub centres in centred 3D space (roughly within a sphere of r≈0.35)
const HUBS3: [number, number, number][] = [
  [0, 0, 0.02], [-0.26, -0.14, 0.12], [0.28, -0.1, -0.14],
  [-0.28, 0.16, -0.06], [0.28, 0.18, 0.12], [0.02, 0.3, -0.04], [0, -0.3, 0.06],
];
const COLORS = ["#b9892b", "#f2b441", "#ffe9b0"]; // tier 0/1/2 (additive gold)
const IDLE_YAW = 0.0013; // slow auto-spin when idle

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
  xs: Float32Array; ys: Float32Array; zs: Float32Array;
  sz: Float32Array; ph: Float32Array; al: Float32Array;
  tier: Uint8Array;
}

function buildLayout(points: GPoint[]): Layout {
  const n = points.length;
  const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
  const sz = new Float32Array(n), ph = new Float32Array(n), al = new Float32Array(n);
  const tier = new Uint8Array(n);
  const rnd = mulberry(1337);
  const g = () => (rnd() + rnd() + rnd() + rnd() - 2) / 2; // ~N(0,~0.5)

  const sorted = points.map((p) => p.l).sort((a, b) => a - b);
  const p97 = sorted[Math.floor(n * 0.97)] ?? Infinity;
  const p80 = sorted[Math.floor(n * 0.8)] ?? Infinity;
  const clamp = (v: number) => Math.max(-0.48, Math.min(0.48, v));

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const t = p.l >= p97 ? 2 : p.l >= p80 ? 1 : 0;
    tier[i] = t;
    const h = HUBS3[i % HUBS3.length];
    const spread = t === 2 ? 0.05 : t === 1 ? 0.1 : 0.17;
    let x = h[0] + g() * spread, y = h[1] + g() * spread, z = h[2] + g() * spread;
    if (t === 0 && rnd() < 0.18) { // a spherical outer halo to fill the frame
      const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1), r = 0.4 + rnd() * 0.08;
      x = Math.sin(b) * Math.cos(a) * r; y = Math.cos(b) * r; z = Math.sin(b) * Math.sin(a) * r;
    }
    xs[i] = clamp(x); ys[i] = clamp(y); zs[i] = clamp(z);
    sz[i] = t === 2 ? 2.7 : t === 1 ? 1.7 : 1.2;
    ph[i] = rnd() * Math.PI * 2;
    al[i] = t === 2 ? 0.98 : t === 1 ? 0.78 : 0.56; // higher floor → always visible
  }
  return { n, xs, ys, zs, sz, ph, al, tier };
}

const fmtGbp = (v?: number) => (v == null ? "—" : "£" + Math.round(v).toLocaleString());

export function CustomerGalaxy({
  onClose, highlightId,
}: { onClose: () => void; highlightId?: string }) {
  const [data, setData] = useState<Galaxy | null>(null);
  const [err, setErr] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ idx: number; x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hoverIdxRef = useRef(-1);
  const highlightIdxRef = useRef(-1);
  const rotRef = useRef({ yaw: 0.5, pitch: -0.12, velYaw: 0, velPitch: 0, dragging: false, lastX: 0, lastY: 0 });

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
  useEffect(() => { highlightIdxRef.current = highlightIdx; }, [highlightIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // the render loop — depends ONLY on `layout`, so hover/drag never restart it.
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const n = layout.n;
    const sxCss = new Float32Array(n), syCss = new Float32Array(n), pdepth = new Float32Array(n);
    let cssW = 1, cssH = 1, dpr = 1, raf = 0;

    const rebuild = () => {
      const rect = wrap.getBoundingClientRect();
      cssW = Math.max(1, rect.width); cssH = Math.max(1, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(cssW * dpr); canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
    };
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(wrap);

    const { xs, ys, zs, sz, ph, al, tier } = layout;
    const draw = (ts: number) => {
      const W = canvas.width, H = canvas.height;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#06070d"; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
      glow.addColorStop(0, "rgba(251,191,36,0.07)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      // rotation: drag drives it; otherwise inertia decays into a slow idle spin
      const r = rotRef.current;
      if (!r.dragging) {
        r.yaw += Math.abs(r.velYaw) > 0.0008 ? r.velYaw : IDLE_YAW;
        r.velYaw *= 0.94;
        r.pitch += r.velPitch; r.velPitch *= 0.9;
      }
      r.pitch = Math.max(-0.65, Math.min(0.65, r.pitch));
      const cy = Math.cos(r.yaw), sy = Math.sin(r.yaw), cp = Math.cos(r.pitch), sp = Math.sin(r.pitch);

      const cxv = W / 2, cyv = H / 2, scaleBase = Math.min(W, H) * 0.92, focal = 1.9;
      const time = ts * 0.001;

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const x = xs[i], y = ys[i], z = zs[i];
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y2 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const persp = focal / (focal - z2);     // toward camera → larger
        const px = cxv + x1 * scaleBase * persp;
        const py = cyv + y2 * scaleBase * persp;
        sxCss[i] = px / dpr; syCss[i] = py / dpr; pdepth[i] = persp;
        const tw = 0.82 + 0.18 * Math.sin(time * 1.3 + ph[i]);
        const depthA = 0.45 + 0.55 * Math.min(1, Math.max(0, (persp - 0.76) / 0.7));
        ctx.globalAlpha = Math.min(1, al[i] * tw * depthA);
        ctx.fillStyle = COLORS[tier[i]];
        const s = sz[i] * persp * dpr;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // active customer — pulsing mint ring
      const hi = highlightIdxRef.current;
      if (hi >= 0) {
        const x = sxCss[hi] * dpr, y = syCss[hi] * dpr, pr = (8 + 3 * Math.sin(time * 2.4)) * dpr;
        ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(52,211,153,0.95)"; ctx.lineWidth = 1.6 * dpr; ctx.stroke();
        ctx.fillStyle = "#34d399"; ctx.beginPath(); ctx.arc(x, y, 2.4 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      const hv = hoverIdxRef.current;
      if (hv >= 0) {
        const x = sxCss[hv] * dpr, y = syCss[hv] * dpr;
        ctx.beginPath(); ctx.arc(x, y, 6.5 * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(253,230,138,0.95)"; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // ---- interaction ----
    let prevBest = -1;
    const pickHover = (mx: number, my: number) => {
      let best = -1, bestDepth = -1;
      for (let i = 0; i < n; i++) {
        const dx = sxCss[i] - mx, dy = syCss[i] - my;
        if (dx * dx + dy * dy < 196 && pdepth[i] > bestDepth) { best = i; bestDepth = pdepth[i]; }
      }
      hoverIdxRef.current = best;
      if (best >= 0) setHoverInfo({ idx: best, x: mx, y: my });
      else if (prevBest >= 0) setHoverInfo(null);
      prevBest = best;
    };
    const onDown = (e: PointerEvent) => {
      const r = rotRef.current;
      r.dragging = true; r.lastX = e.clientX; r.lastY = e.clientY; r.velYaw = 0; r.velPitch = 0;
      wrap.style.cursor = "grabbing";
      hoverIdxRef.current = -1; if (prevBest >= 0) { setHoverInfo(null); prevBest = -1; }
      try { wrap.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };
    const onMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const r = rotRef.current;
      if (r.dragging) {
        const dx = e.clientX - r.lastX, dy = e.clientY - r.lastY;
        r.lastX = e.clientX; r.lastY = e.clientY;
        r.yaw += dx * 0.005; r.pitch += dy * 0.005;
        r.velYaw = dx * 0.005; r.velPitch = dy * 0.005;
        return;
      }
      pickHover(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onUp = () => { rotRef.current.dragging = false; wrap.style.cursor = "grab"; };
    const onLeave = () => { if (!rotRef.current.dragging) { hoverIdxRef.current = -1; if (prevBest >= 0) { setHoverInfo(null); prevBest = -1; } } };

    wrap.style.cursor = "grab";
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointerleave", onLeave);
    };
  }, [layout]);

  const hp = hoverInfo && data ? data.points[hoverInfo.idx] : null;
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
        className="absolute inset-3 overflow-hidden rounded-2xl border border-amber-500/15 bg-[#06070d] md:inset-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={wrapRef} className="absolute inset-0 touch-none select-none">
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
              Every dot is one real customer passport · hover to read · drag to orbit
            </p>
          </div>
          <button
            onClick={onClose}
            className="pointer-events-auto rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
          >
            Close ✕
          </button>
        </div>

        {/* stats panel */}
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

        {!data && !err && (
          <div className="absolute inset-0 grid place-items-center text-amber-200/50">Loading 22,440 passports…</div>
        )}
        {err && (
          <div className="absolute inset-0 grid place-items-center text-amber-300/70">
            Passport memory unavailable — is the API on :8000?
          </div>
        )}

        {/* hover passport card */}
        {hp && hoverInfo && (
          <div
            className="pointer-events-none absolute z-10 w-[210px] rounded-xl border border-amber-400/25 bg-black/80 p-3.5 text-xs shadow-2xl backdrop-blur-md"
            style={{
              left: Math.min(hoverInfo.x + 16, (wrapRef.current?.clientWidth ?? 0) - 226),
              top: Math.min(hoverInfo.y + 16, (wrapRef.current?.clientHeight ?? 0) - 150),
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
