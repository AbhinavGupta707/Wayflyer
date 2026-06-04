import Link from "next/link";

const SCENES = [
  {
    href: "/store",
    title: "Customer",
    blurb: "The shopper's return request — chat / voice intake.",
    owner: "WS4",
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
  },
  {
    href: "/agent",
    title: "Agent View",
    blurb: "Zoom into the swarm's mind — reasoning, tools, the decision.",
    owner: "WS5",
    accent: "from-mint-500/20 to-mint-500/5 border-mint-500/30",
  },
  {
    href: "/ops",
    title: "Ops Ledger",
    blurb: "The rescue ledger — what Keeper recovers, live.",
    owner: "WS7",
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-mint-400">
          Keeper
        </p>
        <h1 className="text-balance text-5xl font-semibold leading-tight md:text-6xl">
          Turn size-driven refunds into{" "}
          <span className="text-mint-400">kept sales</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-400">
          Every number and decision is deterministic. The agent swarm handles the
          words. The ledger proves the money.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {SCENES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group rounded-2xl border bg-gradient-to-b ${s.accent} p-6 transition-transform hover:-translate-y-1`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{s.title}</h2>
                <span className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {s.owner}
                </span>
              </div>
              <p className="text-sm text-slate-400">{s.blurb}</p>
              <span className="mt-4 inline-block text-sm font-medium text-slate-300 group-hover:text-white">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
