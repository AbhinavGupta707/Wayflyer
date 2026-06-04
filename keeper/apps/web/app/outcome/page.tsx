"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "@/lib/api";
import { useScene } from "@/lib/scene";
import { useSession } from "@/lib/session";
import { ProductThumb } from "@/components/product-thumb";
import type { RescueCase } from "@/lib/types";

export default function OutcomePage() {
  const rescueId = useScene((s) => s.activeRescueId);
  const record = useSession((s) => s.recordRespond);
  const { data: rc, isLoading } = useQuery<RescueCase>({
    queryKey: qk.rescue(rescueId || ""),
    queryFn: () => api.rescue(rescueId!),
    enabled: !!rescueId,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function respond(accepted: boolean, msg: string) {
    if (!rescueId) return;
    setBusy(true);
    try {
      const resp = await api.respond(rescueId, { accepted });
      record(resp);
      setDone(msg);
    } finally {
      setBusy(false);
    }
  }

  const first = rc?.passport.name.split(" ")[0] ?? "";
  const ex = rc?.economics.exchange;
  const isExchange = rc?.economics.recommended === "exchange" && !!ex;

  return (
    <main className="lux-bg relative min-h-screen overflow-hidden text-char">
      <div className="lux-drift pointer-events-none" aria-hidden />
      <header className="relative z-10 flex items-center justify-between border-b border-cream-200/70 bg-white/60 px-8 py-4 backdrop-blur-md">
        <Link href="/" className="font-serif text-xl tracking-[0.3em]">PRETTY FLY</Link>
        <Link href="/orders" className="text-sm text-stone-500 hover:text-char">← My Orders</Link>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-65px)] max-w-lg flex-col items-center justify-center px-6">
        {isLoading && <p className="text-stone-500">Loading…</p>}

        {!rescueId && !isLoading && (
          <div className="text-center">
            <p className="text-stone-500">No active return.</p>
            <Link href="/orders" className="mt-4 inline-block rounded-xl bg-char px-6 py-3 text-white">Go to my orders</Link>
          </div>
        )}

        {/* confirmation */}
        {done && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-3xl border border-cream-200 bg-white p-8 text-center shadow-[0_24px_70px_-30px_rgba(0,0,0,0.3)]">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
              <svg className="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.div>
            <h2 className="mt-5 font-serif text-3xl">All done</h2>
            <p className="mx-auto mt-2 max-w-sm text-stone-500">{done}</p>
            <div className="mt-7 flex justify-center gap-3">
              <Link href="/orders" className="rounded-xl bg-char px-6 py-3 font-medium text-white transition hover:bg-black">Back to my orders</Link>
              <Link href="/ops" className="rounded-xl border border-cream-300 bg-white px-6 py-3 font-medium text-stone-700 transition hover:bg-cream-50">Ops ledger</Link>
            </div>
          </motion.div>
        )}

        {/* offer */}
        {rc && !done && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-3xl border border-cream-200 bg-white p-8 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-4">
              <ProductThumb colour={rc.returned.colour || "Charcoal"} productType={rc.genome.product_type} size={rc.returned.size} className="h-16 w-16" />
              <div>
                <div className="text-xs uppercase tracking-wider text-stone-400">Your return</div>
                <div className="font-medium">{rc.returned.title} · {rc.returned.size}</div>
              </div>
            </div>

            {isExchange ? (
              <>
                <h2 className="mt-6 font-serif text-3xl leading-tight">Good news, {first}.</h2>
                <p className="mt-3 text-stone-600">
                  These tend to run a little small. We can ship you the{" "}
                  <span className="font-semibold text-char">{ex!.to_size}</span> today — same price you paid — and include a
                  prepaid label for the {rc.returned.size}. No extra charge, nothing to pay.
                </p>
                <button onClick={() => respond(true, `Your ${ex!.to_size} is on its way — we've emailed a prepaid label for the ${rc.returned.size}. Nothing to pay.`)}
                  disabled={busy}
                  className="mt-7 w-full rounded-xl bg-char py-3.5 font-medium text-white transition hover:bg-black disabled:opacity-40">
                  {busy ? "One sec…" : `Yes — send me the ${ex!.to_size}`}
                </button>
                <button onClick={() => respond(false, "No problem — your refund is on its way. You'll see it in 3–5 working days.")}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-cream-300 bg-white py-3 text-stone-600 transition hover:bg-cream-50 disabled:opacity-40">
                  No thanks, just refund me
                </button>
              </>
            ) : (
              <>
                <h2 className="mt-6 font-serif text-3xl leading-tight">We&apos;re on it, {first}.</h2>
                <p className="mt-3 text-stone-600">We&apos;ll get your return sorted right away and pop your refund back to your original payment method.</p>
                <button onClick={() => respond(true, "Your refund is on its way — you'll see it in 3–5 working days.")}
                  disabled={busy}
                  className="mt-7 w-full rounded-xl bg-char py-3.5 font-medium text-white transition hover:bg-black disabled:opacity-40">
                  {busy ? "One sec…" : "Confirm my return"}
                </button>
              </>
            )}
          </motion.div>
        )}
      </div>
    </main>
  );
}
