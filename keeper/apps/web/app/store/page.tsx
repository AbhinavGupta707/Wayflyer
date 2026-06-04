// PLACEHOLDER — owned by WS4 (customer scene). Replace this file.
// Wire the handoff with: useScene((s) => s.openAgentView)(rescueId)
import Link from "next/link";

export default function StorePlaceholder() {
  return (
    <main className="grid min-h-screen place-items-center bg-grid p-8 text-center">
      <div>
        <p className="text-sm uppercase tracking-widest text-sky-400">WS4 · Customer</p>
        <h1 className="mt-2 text-3xl font-semibold">Store scene goes here</h1>
        <p className="mt-2 max-w-md text-slate-400">
          The shell is ready. Drop the customer chat/voice intake into{" "}
          <code className="text-slate-300">app/store/</code> and call{" "}
          <code className="text-slate-300">openAgentView(id)</code> to hand off.
        </p>
        <Link href="/" className="mt-6 inline-block text-mint-400 hover:underline">
          ← back
        </Link>
      </div>
    </main>
  );
}
