"use client";

// WS5 — the Agent View. The cinematic "AI reasoning" console for one rescue:
//   left  = vertical timeline of step cards
//   center= the swarm graph lighting up edge-by-edge
//   right = the Decision card once the terminal event lands
//   bottom= the live reasoning console
// Drives entirely off fixtures/step_stream.json via the Replay button (offline),
// and can swap to the live Contract-B socket (subscribeStream) with one toggle.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { subscribeStream } from "@/lib/api";
import type { StreamEvent } from "@/lib/types";
import STEP_STREAM from "@/app/agent/step_stream.json";
import { AgentBackdrop } from "./agent-fx";
import { AgentConsole } from "./agent-console";
import { AgentDecisionCard } from "./agent-decision-card";
import { AgentStepCard } from "./agent-step-card";
import { AgentSwarmGraph } from "./agent-swarm-graph";
import { useAgentStream } from "./agent-replay";
import { cn } from "./agent-cn";

const FIXTURE = STEP_STREAM as unknown as StreamEvent[];
const TOTAL_STEPS = FIXTURE.filter((e) => e.kind !== "decision").length;
const DEFAULT_RESCUE_ID = "rsc_demo_0001";

export function AgentView({
  onReturnToCustomer,
  rescueId = DEFAULT_RESCUE_ID,
}: {
  onReturnToCustomer?: () => void;
  rescueId?: string;
}) {
  const { state, playAll, begin, reset } = useAgentStream();
  const [source, setSource] = useState<"replay" | "live">("replay");
  const unsubRef = useRef<(() => void) | null>(null);

  const stopLive = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  const replay = useCallback(() => {
    stopLive();
    setSource("replay");
    playAll(FIXTURE);
  }, [playAll, stopLive]);

  const goLive = useCallback(() => {
    stopLive();
    setSource("live");
    const { feed, end } = begin();
    unsubRef.current = subscribeStream(rescueId, (ev) => feed(ev), {
      onClose: end,
      onError: end,
    });
  }, [begin, rescueId, stopLive]);

  // Autoplay the fixture on first mount.
  useEffect(() => {
    playAll(FIXTURE);
    return () => {
      stopLive();
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReturn = useCallback(() => {
    onReturnToCustomer?.();
  }, [onReturnToCustomer]);

  const doneCount = state.steps.filter((s) => s.phase === "done").length;
  const playing = state.status === "playing";

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-ink-900 text-white">
      <AgentBackdrop />

      {/* ---- header ---- */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint-500/15 text-lg shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]">
            🧠
          </span>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">
              Keeper · Agent Reasoning
            </h1>
            <p className="font-mono text-[11px] text-white/40">
              case {rescueId} · Court Trainer return · Blessing Nowak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* status pill */}
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
              playing
                ? "border-mint-500/40 text-mint-400"
                : state.status === "done"
                  ? "border-white/10 text-white/55"
                  : "border-white/10 text-white/40",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                playing ? "animate-pulse bg-mint-400" : state.status === "done" ? "bg-white/40" : "bg-white/25",
              )}
            />
            {playing ? "reasoning…" : state.status === "done" ? "complete" : "idle"}
            <span className="ml-1 font-mono text-white/35">
              {doneCount}/{TOTAL_STEPS}
            </span>
          </span>

          {/* source toggle */}
          <div className="flex overflow-hidden rounded-lg border border-white/10 text-[11px]">
            <button
              type="button"
              onClick={replay}
              className={cn(
                "px-3 py-1.5 font-medium transition-colors",
                source === "replay" ? "bg-mint-500 text-ink-900" : "text-white/60 hover:bg-white/5",
              )}
            >
              ⟳ Replay
            </button>
            <button
              type="button"
              onClick={goLive}
              title="Connect to /api/rescue/{id}/stream"
              className={cn(
                "border-l border-white/10 px-3 py-1.5 font-medium transition-colors",
                source === "live" ? "bg-mint-500 text-ink-900" : "text-white/60 hover:bg-white/5",
              )}
            >
              ● Live
            </button>
          </div>
        </div>
      </header>

      {/* ---- main: timeline | swarm | decision ---- */}
      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[340px_minmax(0,1fr)_minmax(360px,400px)]">
        {/* left: step timeline */}
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-2 px-1 text-[10px] uppercase tracking-widest text-white/30">
            Reasoning steps
          </h2>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {state.steps.map((step) => (
                <AgentStepCard
                  key={step.seq}
                  step={step}
                  active={step.phase !== "done" && playing}
                />
              ))}
            </AnimatePresence>
            {state.steps.length === 0 && (
              <p className="px-1 text-[12px] text-white/30">Press Replay to begin…</p>
            )}
          </div>
        </section>

        {/* center: swarm graph */}
        <section className="relative min-h-0 overflow-hidden rounded-2xl border border-white/5 bg-ink-800/30">
          <span className="pointer-events-none absolute left-3 top-3 z-10 text-[10px] uppercase tracking-widest text-white/30">
            Agent swarm
          </span>
          <AgentSwarmGraph
            activeNode={state.activeNode}
            activeEdge={state.activeEdge}
            litEdges={state.litEdges}
            visited={state.visited}
          />
        </section>

        {/* right: decision */}
        <section className="flex min-h-0 flex-col overflow-y-auto">
          <h2 className="mb-2 px-1 text-[10px] uppercase tracking-widest text-white/30">
            Decision
          </h2>
          <AnimatePresence mode="wait">
            {state.decision ? (
              <AgentDecisionCard
                key="decision"
                event={state.decision}
                onReturnToCustomer={handleReturn}
              />
            ) : (
              <motion.div
                key="pending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-6 text-center"
              >
                <span className="text-2xl">⚖️</span>
                <p className="mt-2 text-[12.5px] text-white/45">
                  Weighing refund vs exchange…
                </p>
                <p className="mt-1 font-mono text-[11px] text-white/25">
                  the deterministic engine owns every £
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* ---- bottom: live console ---- */}
      <footer className="relative z-10 h-[150px] shrink-0 px-4 pb-3">
        <AgentConsole lines={state.console} />
      </footer>
    </div>
  );
}
