"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "@/lib/api";
import { gbp } from "@/lib/format";
import { useCustomer } from "@/lib/customer";
import { useScene } from "@/lib/scene";
import { CustomerSwitcher } from "@/components/customer-switcher";
import { ProductThumb } from "@/components/product-thumb";
import type { CustomerOrders, CustomerOrder, OrderItem, OrderStatus } from "@/lib/types";

const NAV = ["Shop", "New In", "Best Sellers", "Collections", "Sale"];
const MENU = ["Account Overview", "My Orders", "Returns & Refunds", "Addresses", "Payment Methods", "Wishlist", "Saved Items", "Account Settings"];
const TABS: (OrderStatus | "All")[] = ["All", "Processing", "Shipped", "Delivered", "Returns", "Cancelled"];
const REASONS = [
  { label: "Too small", value: "size_too_small" }, { label: "Too big", value: "size_too_large" },
  { label: "Changed mind", value: "changed_mind" }, { label: "Quality issue", value: "quality_issue" },
  { label: "Damaged", value: "damaged_in_transit" }, { label: "Not as described", value: "not_as_described" },
];
const PILL: Record<string, string> = {
  Delivered: "bg-emerald-50 text-emerald-700", Shipped: "bg-sky-50 text-sky-700",
  Processing: "bg-amber-50 text-amber-700", Returns: "bg-stone-100 text-stone-600",
  Cancelled: "bg-red-50 text-red-600",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrdersPage() {
  const router = useRouter();
  const { customerId } = useCustomer();
  const openAgentView = useScene((s) => s.openAgentView);
  const { data } = useQuery<CustomerOrders>({
    queryKey: qk.customerOrders(customerId || ""),
    queryFn: () => api.customerOrders(customerId!),
    enabled: !!customerId,
  });

  const [tab, setTab] = useState<(OrderStatus | "All")>("All");
  const [retOrder, setRetOrder] = useState<CustomerOrder | null>(null);
  const [selItem, setSelItem] = useState<OrderItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const orders = useMemo(() => (data?.orders ?? []).slice().reverse(), [data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] || 0) + 1;
    return c;
  }, [orders]);
  const shown = tab === "All" ? orders : orders.filter((o) => o.status === tab);
  const first = data?.name.split(" ")[0] ?? "";

  function openReturn(o: CustomerOrder) {
    setRetOrder(o);
    const def = o.items.find((i) => i.returned) ?? o.items[0];
    setSelItem(def);
    setReason(def?.return_reason || "");
  }
  async function submit() {
    if (!retOrder || !selItem || !reason || !customerId) return;
    setBusy(true);
    try {
      const { rescue_id } = await api.intake({ variant_id: selItem.variant_id, customer_id: customerId, order_id: retOrder.order_id, reason });
      openAgentView(rescue_id);
      router.push("/agent");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-cream-50 text-char">
      {/* top nav */}
      <header className="sticky top-0 z-30 border-b border-cream-200 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-4">
          <Link href="/" className="font-serif text-xl tracking-[0.3em]">PRETTY FLY</Link>
          <nav className="hidden gap-6 text-sm text-stone-600 lg:flex">
            {NAV.map((n) => <span key={n} className="cursor-pointer transition hover:text-char">{n}</span>)}
          </nav>
          <div className="ml-auto flex items-center gap-5">
            <div className="hidden items-center gap-2 rounded-full border border-cream-200 bg-white px-4 py-2 text-sm text-stone-400 md:flex">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" strokeLinecap="round" /></svg>
              <span>Search for products…</span>
            </div>
            <CustomerSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[260px_1fr]">
        {/* sidebar */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-cream-200 bg-white p-5">
            <div className="flex items-center gap-3 border-b border-cream-100 pb-4">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-cream-300 text-sm font-medium">{first.slice(0, 1)}{data?.name.split(" ")[1]?.slice(0, 1)}</span>
              <div className="min-w-0">
                <div className="font-medium">Hello, {first}</div>
                <div className="truncate text-xs text-stone-500">{data?.email}</div>
              </div>
            </div>
            <nav className="mt-3 space-y-0.5 text-sm">
              {MENU.map((m) => (
                <div key={m} className={`cursor-pointer rounded-lg px-3 py-2 transition ${m === "My Orders" ? "bg-cream-100 font-medium text-char" : "text-stone-600 hover:bg-cream-50"}`}>{m}</div>
              ))}
              <div className="cursor-pointer rounded-lg px-3 py-2 text-red-600 transition hover:bg-red-50">Log Out</div>
            </nav>
          </div>
          <div className="mt-4 rounded-2xl border border-cream-200 bg-gradient-to-b from-cream-100 to-white p-5">
            <div className="font-medium">Need Help?</div>
            <p className="mt-1 text-xs text-stone-500">Our support team is here for you.</p>
            <button className="mt-3 w-full rounded-lg border border-cream-300 bg-white py-2 text-sm transition hover:bg-cream-50">Contact Support</button>
          </div>
        </aside>

        {/* main */}
        <section>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-stone-400">
            <Link href="/" className="hover:text-char">Home</Link><span>›</span><span>My Account</span><span>›</span><span className="text-stone-600">My Orders</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-4xl">My Orders</h1>
              <p className="mt-1 text-sm text-stone-500">Track, manage, and return your orders all in one place.</p>
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-stone-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" /></svg>
              Filter
            </button>
          </div>

          {/* tabs */}
          <div className="mt-6 flex flex-wrap gap-1.5 border-b border-cream-200 pb-3">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition ${tab === t ? "bg-char text-white" : "text-stone-500 hover:bg-cream-100"}`}>
                {t === "All" ? "All Orders" : t}
                <span className={`rounded-full px-1.5 text-xs ${tab === t ? "bg-white/20" : "bg-cream-200 text-stone-500"}`}>{counts[t] || 0}</span>
              </button>
            ))}
          </div>

          {/* order cards */}
          <div className="mt-5 space-y-4">
            {shown.map((o) => {
              const lead = o.items[0];
              const canReturn = o.status === "Delivered" || o.status === "Returns";
              return (
                <div key={o.order_id} className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
                  <div className="flex items-center gap-4 p-5">
                    <ProductThumb colour={lead?.colour || ""} productType={lead?.product_type || ""} size={lead?.size} className="h-20 w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">Order #{o.order_number}</div>
                      <div className="text-xs text-stone-500">{fmtDate(o.created_at)} · {o.item_count} item{o.item_count > 1 ? "s" : ""}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[o.status]}`}>{o.status === "Returns" ? "Returned" : o.status}</span>
                        <span className="text-xs text-stone-500">{o.status_line}</span>
                      </div>
                      <div className="mt-1 truncate text-xs text-stone-400">
                        {lead?.title}{o.items.length > 1 ? ` + ${o.items.length - 1} more` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="font-medium tabular-nums">{gbp(o.total_price)}</div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm text-stone-700 transition hover:bg-cream-50">
                          {o.status === "Shipped" ? "Track Package" : "View Order"}
                        </button>
                        {canReturn ? (
                          <button onClick={() => openReturn(o)} className="rounded-lg bg-char px-3.5 py-2 text-sm text-white transition hover:bg-black">Return or Replace</button>
                        ) : o.status === "Processing" ? (
                          <button className="rounded-lg border border-cream-300 bg-white px-3.5 py-2 text-sm text-stone-700 transition hover:bg-cream-50">Cancel Order</button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-cream-100 bg-cream-50/60 px-5 py-2.5 text-xs text-stone-500">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7" /><circle cx="7" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></svg>
                    {o.status === "Returns" ? "Return processed · refund issued" : `${o.status === "Shipped" ? "Shipping" : "Delivered"} to ${data?.address}`}
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && <p className="py-12 text-center text-sm text-stone-400">No orders in this tab.</p>}
          </div>
        </section>
      </div>

      {/* return modal */}
      <AnimatePresence>
        {retOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-char/40 p-4 backdrop-blur-sm" onClick={() => !busy && setRetOrder(null)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-cream-200 bg-white p-6 text-char" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif text-2xl">Return or replace</h3>
              <p className="text-sm text-stone-500">Order #{retOrder.order_number}</p>

              <div className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">Which item?</div>
              <div className="space-y-2">
                {retOrder.items.map((it, i) => (
                  <button key={i} onClick={() => { setSelItem(it); setReason(it.return_reason || ""); }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${selItem === it ? "border-char bg-cream-50" : "border-cream-200 hover:bg-cream-50"}`}>
                    <ProductThumb colour={it.colour} productType={it.product_type} size={it.size} className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.title}</div>
                      <div className="text-xs text-stone-500">{it.colour} · {it.size}</div>
                    </div>
                    {it.returned && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">previously returned</span>}
                  </button>
                ))}
              </div>

              <div className="mt-4 mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">What went wrong?</div>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r.value} onClick={() => setReason(r.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${reason === r.value ? "border-char bg-char text-white" : "border-cream-300 text-stone-600 hover:bg-cream-50"}`}>{r.label}</button>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setRetOrder(null)} disabled={busy}
                  className="rounded-xl border border-cream-300 bg-white py-3 font-medium text-stone-700 transition hover:bg-cream-50 disabled:opacity-40">
                  Continue
                </button>
                <button onClick={submit} disabled={!selItem || !reason || busy}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-char py-3 font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? "Opening…" : <>Agent View <span aria-hidden>→</span></>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
