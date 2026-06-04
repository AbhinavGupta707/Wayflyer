"use client";

// WS7 — Ops Ledger. The business-value proof, live from GET /api/ledger
// (recomputed by WS2's LLM-free backtest). Plus the "trainers run small"
// SKU intelligence and a live this-session counter that ticks on each accept.

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import Link from "next/link";
import { api, qk } from "@/lib/api";
import { gbp, gbpPence, num, pct, monthLabel } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { LedgerSummary } from "@/lib/types";

const MINT = "#34d399";
const AMBER = "#fbbf24";

function Stat({
  label, value, sub, accent = "text-white", glow = false,
}: { label: string; value: string; sub?: string; accent?: string; glow?: boolean }) {
  return (
    <div className={`rounded-2xl border border-ink-600 bg-ink-800/60 p-5 ${glow ? "ring-1 ring-mint-500/40" : ""}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-1.5 text-3xl font-semibold tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Arrow() {
  return <div className="hidden self-center text-2xl text-slate-600 md:block">→</div>;
}

export default function OpsPage() {
  const { data: l, isLoading, error } = useQuery<LedgerSummary>({
    queryKey: qk.ledger,
    queryFn: api.ledger,
    refetchInterval: 15000,
  });

  // Live "this session" counter — pops on each accept (lib/session.ts).
  const { rescuesSaved, marginGbp, lastTick } = useSession();
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = popRef.current;
    if (!el || lastTick === 0) return;
    el.classList.remove("animate-tick-pop");
    void el.offsetWidth; // restart the animation
    el.classList.add("animate-tick-pop");
  }, [lastTick]);

  if (isLoading) return <Shell><p className="text-slate-500">Loading the ledger…</p></Shell>;
  if (error || !l) return <Shell><p className="text-amber-400">Ledger unavailable — is the API on :8000?</p></Shell>;

  const skuData = (l.top_skus || []).map((s) => ({ name: s.sku.replace(" Trainer", ""), gbp: s.recovered_gbp, full: s.sku }));
  const monthData = Object.entries(l.by_month || {}).map(([ym, v]) => ({ m: monthLabel(ym), gbp: v }));
  const runsSmall = (l.top_skus || []).filter((s) => /Trainer/.test(s.sku));

  return (
    <Shell>
      {/* header + live counter */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">Rescue Ledger</p>
          <h1 className="mt-1 text-3xl font-semibold">What Keeper recovers — proven on {num(l.total_refunds)} real refunds</h1>
          <p className="mt-1 text-sm text-slate-500">LLM-free backtest · point-in-time stock · reproducible to the penny</p>
        </div>
        <div ref={popRef} className="rounded-2xl border border-mint-500/40 bg-mint-500/10 px-5 py-3 text-right">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-mint-400">This session</div>
          <div className="text-2xl font-semibold tabular-nums text-mint-400">
            {num(rescuesSaved)} saved · {gbpPence(marginGbp)}
          </div>
        </div>
      </div>

      {/* the funnel */}
      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        <Stat label="Size-driven refunds" value={gbp(l.size_refund_gbp)} sub={`${num(l.size_refunds)} refunds`} accent="text-slate-300" />
        <Arrow />
        <Stat label="Addressable by exchange" value={gbp(l.addressable_recovered_gbp)} sub={`${num(l.addressable_count)} had the size in stock`} accent="text-white" />
        <Arrow />
        <Stat label="Margin retained" value={gbp(l.addressable_margin_gbp)} sub={l.conservative_margin_gbp ? `${gbp(l.conservative_margin_gbp)} conservative` : undefined} accent="text-mint-400" glow />
        <Arrow />
        <Stat label={`Realistic @ ${pct(l.accept_rate_assumed)}`} value={gbp(l.realistic_margin_gbp)} sub="margin, after acceptance" accent="text-mint-400" />
      </div>

      {/* stockout callout */}
      {l.lost_to_stockout_gbp != null && (
        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm">
          <span className="font-semibold text-amber-400">{gbp(l.lost_to_stockout_gbp)}</span>{" "}
          <span className="text-slate-300">of recoverable size-swaps were lost because the corrective size was out of stock at the time</span>{" "}
          <span className="text-slate-500">({num(l.lost_to_stockout_count || 0)} returns — an inventory fix, not a returns one).</span>
        </div>
      )}

      {/* charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Recoverable revenue by product" hint="Trainers run small — they dominate recoverable returns.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={skuData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={tooltipStyle} formatter={(v: number) => [gbp(v), "recoverable"]} />
              <Bar dataKey="gbp" radius={[0, 4, 4, 0]}>
                {skuData.map((d, i) => (
                  <Cell key={i} fill={/Trainer/.test(d.full) ? MINT : "#475569"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Recoverable revenue by month" hint="Steady leakage — every month is recoverable margin.">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthData} margin={{ left: 0, right: 12, top: 8 }}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={MINT} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={MINT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="m" tick={{ fill: "#64748b", fontSize: 10 }} interval={1} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `£${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [gbp(v), "recoverable"]} />
              <Area type="monotone" dataKey="gbp" stroke={MINT} strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* SKU intelligence */}
      <Panel title="SKU intelligence — fix the source" hint="Auto-surfaced for the buying team." className="mt-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {runsSmall.map((s) => (
            <div key={s.sku} className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-900/40 px-4 py-3">
              <div>
                <div className="font-medium">{s.sku}</div>
                <div className="text-xs text-amber-400">runs small → recommend size up</div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums text-mint-400">{gbp(s.recovered_gbp)}</div>
                <div className="text-xs text-slate-500">{num(s.recoverable)} rescuable</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-8 flex gap-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-white">← Home</Link>
        <Link href="/store" className="hover:text-white">Customer →</Link>
        <Link href="/agent" className="hover:text-white">Agent View →</Link>
      </div>
    </Shell>
  );
}

const tooltipStyle = { background: "#0f1622", border: "1px solid #1e2b3d", borderRadius: 12, color: "#e6edf3", fontSize: 12 };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
    </main>
  );
}

function Panel({ title, hint, className = "", children }: { title: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-ink-600 bg-ink-800/40 p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
