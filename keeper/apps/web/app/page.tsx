"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "@/lib/api";
import { useCustomer } from "@/lib/customer";
import { CustomerSwitcher } from "@/components/customer-switcher";
import type { DemoCustomer } from "@/lib/types";

export default function Home() {
  const { data: customers } = useQuery<DemoCustomer[]>({ queryKey: qk.customers, queryFn: api.customers });
  const { customerId } = useCustomer();
  const current = customers?.find((c) => c.customer_id === customerId) || customers?.[0];
  const first = current?.name.split(" ")[0] || "there";

  return (
    <main className="lux-bg relative min-h-screen overflow-hidden text-char">
      <div className="lux-drift pointer-events-none" aria-hidden />

      <header className="relative z-10 flex items-center justify-between border-b border-cream-200/70 bg-white/60 px-8 py-4 backdrop-blur-md">
        <span className="font-serif text-2xl tracking-[0.35em] text-char">PRETTY FLY</span>
        <div className="flex items-center gap-5">
          <CustomerSwitcher />
          <span className="h-6 w-px bg-cream-300" />
          <button className="text-stone-500 transition hover:text-char" aria-label="Notifications">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" /></svg>
          </button>
          <button className="text-stone-500 transition hover:text-char" aria-label="Settings">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-73px)] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="font-serif text-6xl leading-[1.06] text-char md:text-7xl"
        >
          Welcome back,<br />{first}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.12 }}
          className="mt-6 text-lg leading-relaxed text-stone-500"
        >
          Track, manage, and return your orders<br />all in one place.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24 }}>
          <Link
            href="/orders"
            className="mt-10 inline-flex items-center gap-2.5 rounded-xl bg-char px-8 py-4 font-medium text-white shadow-[0_14px_40px_-12px_rgba(0,0,0,0.5)] transition hover:translate-y-[-1px] hover:bg-black"
          >
            View My Orders
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
