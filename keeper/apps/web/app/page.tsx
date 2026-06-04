"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CustomerSwitcher } from "@/components/customer-switcher";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-900">
      <div className="aurora" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-[0.3em] text-white/80">PRETTY FLY</span>
        <CustomerSwitcher />
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-4 text-xs font-medium uppercase tracking-[0.35em] text-mint-400"
        >
          Premium streetwear
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
          className="text-balance text-6xl font-semibold leading-[1.04] text-white md:text-7xl"
        >
          Made to keep.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-5 max-w-md text-lg text-slate-400"
        >
          And when something isn&apos;t quite right, we make it right — instantly.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10"
        >
          <Link
            href="/orders"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-medium text-ink-900 shadow-xl transition hover:scale-[1.03] hover:shadow-[0_8px_40px_-8px_rgba(16,185,129,0.45)]"
          >
            View your orders
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-8 flex gap-5 text-xs text-slate-600"
        >
          <Link href="/store" className="hover:text-slate-300">Browse catalogue</Link>
          <span>·</span>
          <Link href="/ops" className="hover:text-slate-300">Ops ledger</Link>
        </motion.div>
      </div>
    </main>
  );
}
