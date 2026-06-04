"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "@/lib/api";
import { gbp } from "@/lib/format";
import { swatch } from "@/lib/colour";
import { useCustomer } from "@/lib/customer";
import { useScene } from "@/lib/scene";
import { CustomerSwitcher } from "@/components/customer-switcher";
import type { CustomerOrders, OrderItem } from "@/lib/types";

const REASONS: { label: string; value: string }[] = [
  { label: "Too small", value: "size_too_small" },
  { label: "Too big", value: "size_too_large" },
  { label: "Changed mind", value: "changed_mind" },
  { label: "Quality issue", value: "quality_issue" },
  { label: "Damaged", value: "damaged_in_transit" },
  { label: "Not as described", value: "not_as_described" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrdersPage() {
  const router = useRouter();
  const { customerId } = useCustomer();
  const openAgentView = useScene((s) => s.openAgentView);

  const { data, isLoading } = useQuery<CustomerOrders>({
    queryKey: qk.customerOrders(customerId || ""),
    queryFn: () => api.customerOrders(customerId!),
    enabled: !!customerId,
  });

  const [active, setActive] = useState<{ order_id: string; item: OrderItem } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function openReturn(order_id: string, item: OrderItem) {
    setActive({ order_id, item });
    setReason(item.return_reason || "");
  }

  async function submit() {
    if (!active || !reason || !customerId) return;
    setBusy(true);
    try {
      const { rescue_id } = await api.intake({
        variant_id: active.item.variant_id,
        customer_id: customerId,
        order_id: active.order_id,
        reason,
      });
      openAgentView(rescue_id);
      router.push("/agent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-grid">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-ink-900/80 px-6 py-4 backdrop-blur">
        <Link href="/" className="text-sm font-semibold tracking-[0.3em] text-white/80">PRETTY FLY</Link>
        <CustomerSwitcher />
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Your orders</h1>
          {data && <p className="text-sm text-slate-500">{data.name} · {data.orders_count} orders · lifetime {gbp(data.ltv)}</p>}
        </div>

        {isLoading && <p className="text-slate-500">Loading orders…</p>}

        <div className="space-y-5">
          {data?.orders.slice().reverse().map((order) => (
            <div key={order.order_id} className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800/40">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-white/[0.02] px-5 py-3 text-xs text-slate-400">
                <div className="flex gap-6">
                  <span>ORDER <span className="text-slate-200">#{order.order_number}</span></span>
                  <span>{fmtDate(order.created_at)}</span>
                </div>
                <span className="tabular-nums text-slate-300">{gbp(order.total_price)}</span>
              </div>
              <div className="divide-y divide-white/5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/10" style={{ background: swatch(item.colour) }}>
                      <span className="text-[10px] font-medium text-white/70 mix-blend-difference">{item.size}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{item.title}</span>
                        {item.returned && (
                          <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">Returned</span>
                        )}
                        {item.runs === "small" && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400">runs small</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{item.colour} · {item.size} · qty {item.quantity}</div>
                    </div>
                    <div className="hidden w-16 text-right text-sm tabular-nums text-slate-300 sm:block">{gbp(item.price)}</div>
                    <button
                      onClick={() => openReturn(order.order_id, item)}
                      className="shrink-0 rounded-lg border border-ink-500 px-3 py-1.5 text-sm text-slate-200 transition hover:border-mint-400 hover:text-white"
                    >
                      Return
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* return modal */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => !busy && setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-white/10" style={{ background: swatch(active.item.colour) }}>
                  <span className="text-[10px] text-white/70 mix-blend-difference">{active.item.size}</span>
                </div>
                <div>
                  <h3 className="font-semibold">{active.item.title}</h3>
                  <p className="text-xs text-slate-500">{active.item.colour} · size {active.item.size}</p>
                </div>
              </div>

              <div className="mt-5 mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">What went wrong?</div>
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

              <button
                onClick={submit}
                disabled={!reason || busy}
                className="mt-6 w-full rounded-xl bg-mint-500 py-3 font-medium text-ink-900 transition hover:bg-mint-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Finding your best option…" : "✨ Find my best option"}
              </button>
              <button onClick={() => setActive(null)} className="mt-2 w-full py-1.5 text-xs text-slate-500 hover:text-slate-300">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
