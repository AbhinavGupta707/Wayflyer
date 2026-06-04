"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "@/lib/api";
import { useCustomer } from "@/lib/customer";
import { gbp } from "@/lib/format";
import type { DemoCustomer } from "@/lib/types";

// Light-themed switcher for the cream storefront nav (avatar + name + dropdown).
export function CustomerSwitcher() {
  const { data: customers } = useQuery<DemoCustomer[]>({ queryKey: qk.customers, queryFn: api.customers });
  const { customerId, setCustomer } = useCustomer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!customerId && customers && customers.length) setCustomer(customers[0].customer_id);
  }, [customerId, customers, setCustomer]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = customers?.find((c) => c.customer_id === customerId) || customers?.[0];
  if (!current) return <div className="h-9 w-36 animate-pulse rounded-full bg-cream-200" />;
  const initials = current.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div ref={ref} className="relative z-50">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-cream-300 text-sm font-medium text-char">{initials}</span>
        <span className="hidden text-sm font-medium text-char sm:block">{current.name}</span>
        <svg className={`h-3.5 w-3.5 text-stone-500 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && customers && (
        <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
          <div className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-stone-400">Shop as…</div>
          <div className="max-h-80 overflow-y-auto">
            {customers.map((c) => (
              <button
                key={c.customer_id}
                onClick={() => { setCustomer(c.customer_id); setOpen(false); }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-cream-50 ${c.customer_id === current.customer_id ? "bg-cream-50" : ""}`}
              >
                <div>
                  <div className="text-sm font-medium text-char">{c.name}</div>
                  <div className="text-xs text-stone-500">{c.orders_count} orders · {c.country} · {c.segment}</div>
                </div>
                <div className="text-xs tabular-nums text-stone-500">{gbp(c.ltv)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
