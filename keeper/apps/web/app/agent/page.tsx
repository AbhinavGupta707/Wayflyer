// PLACEHOLDER — owned by WS5 (agent view). Replace this file.
// Stream with: subscribeStream(id, onEvent) from "@/lib/api"
// Return with:  useScene((s) => s.returnToCustomer)()
import Link from "next/link";

export default function AgentPlaceholder() {
  return (
    <main className="grid min-h-screen place-items-center bg-grid p-8 text-center">
      <div>
        <p className="text-sm uppercase tracking-widest text-mint-400">WS5 · Agent View</p>
        <h1 className="mt-2 text-3xl font-semibold">Agent view goes here</h1>
        <p className="mt-2 max-w-md text-slate-400">
          The shell is ready. Drop the swarm graph + reasoning stream into{" "}
          <code className="text-slate-300">app/agent/</code> and call{" "}
          <code className="text-slate-300">returnToCustomer()</code> when done.
        </p>
        <Link href="/" className="mt-6 inline-block text-mint-400 hover:underline">
          ← back
        </Link>
      </div>
    </main>
  );
}
