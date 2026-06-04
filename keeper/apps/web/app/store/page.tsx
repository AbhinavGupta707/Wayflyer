"use client";

// WS4 — Customer storefront & return flow. Pick ANY product + size + reason;
// the intake builds a real RescueCase and the engine decides live. Hands off to
// the Agent View via the scene controller.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, qk, API_BASE } from "@/lib/api";
import { gbp } from "@/lib/format";
import { useScene } from "@/lib/scene";
import type { SkuGenome } from "@/lib/types";

const REASONS: { label: string; value: string }[] = [
  { label: "Too small", value: "size_too_small" },
  { label: "Too big", value: "size_too_large" },
  { label: "Changed mind", value: "changed_mind" },
  { label: "Quality issue", value: "quality_issue" },
  { label: "Damaged", value: "damaged_in_transit" },
  { label: "Not as described", value: "not_as_described" },
];

export default function StorePage() {
  const router = useRouter();
  const openAgentView = useScene((s) => s.openAgentView);
  const { data: catalog, isLoading } = useQuery<SkuGenome[]>({ queryKey: qk.catalog, queryFn: api.catalog });

  const [sel, setSel] = useState<SkuGenome | null>(null);
  const [size, setSize] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!sel || !size || !reason) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/returns/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: sel.product_id, size, reason }),
      });
      const { rescue_id } = await res.json();
      openAgentView(rescue_id);        // set scene + active rescue
      router.push("/agent");            // zoom into the agent's mind
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Pretty Fly · Returns</p>
            <h1 className="mt-1 text-3xl font-semibold">Start a return</h1>
            <p className="mt-1 text-sm text-slate-500">Pick anything — Keeper decides the best outcome live.</p>
          </div>
          <Link href="/ops" className="text-sm text-slate-500 hover:text-white">Ops Ledger →</Link>
        </div>

        {isLoading && <p className="text-slate-500">Loading catalogue…</p>}

        {!sel && catalog && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((p) => (
              <button
                key={p.product_id}
                onClick={() => { setSel(p); setSize(""); setReason(""); }}
                className="group rounded-2xl border border-ink-600 bg-ink-800/50 p-5 text-left transition hover:border-sky-500/40 hover:bg-ink-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-slate-500">{p.product_type}</div>
                  </div>
                  <div className="text-sm tabular-nums text-slate-300">{gbp(p.price)}</div>
                </div>
                {p.runs === "small" && (
                  <span className="mt-3 inline-block rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                    runs small
                  </span>
                )}
                <span className="mt-3 block text-sm text-sky-400 opacity-0 transition group-hover:opacity-100">Return this →</span>
              </button>
            ))}
          </div>
        )}

        {sel && (
          <div className="mx-auto max-w-xl rounded-2xl border border-ink-600 bg-ink-800/60 p-6">
            <button onClick={() => setSel(null)} className="mb-4 text-sm text-slate-500 hover:text-white">← All products</button>
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">{sel.title}</h2>
              <span className="tabular-nums text-slate-300">{gbp(sel.price)}</span>
            </div>
            <p className="text-xs text-slate-500">{sel.product_type}{sel.runs === "small" ? " · runs small" : ""}</p>

            <div className="mt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Which size are you returning?</div>
              <div className="flex flex-wrap gap-2">
                {sel.size_ladder.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${size === s ? "border-sky-400 bg-sky-500/15 text-white" : "border-ink-500 text-slate-300 hover:border-slate-400"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">What went wrong?</div>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${reason === r.value ? "border-mint-400 bg-mint-500/15 text-white" : "border-ink-500 text-slate-300 hover:border-slate-400"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={!size || !reason || busy}
              className="mt-7 w-full rounded-xl bg-mint-500 py-3 font-medium text-ink-900 transition hover:bg-mint-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Finding your best option…" : "✨ Find my best option"}
            </button>
            <p className="mt-2 text-center text-xs text-slate-600">Opens the agent view — watch Keeper reason in real time.</p>
          </div>
        )}
      </div>
    </main>
  );
}
