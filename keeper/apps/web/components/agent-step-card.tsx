"use client";

// One card per StepEvent in the left timeline. Lifecycle:
//   thinking  → icon + spinner, label, "thinking…"
//   streaming → typewriter reveals the `thinking` text with a blinking caret
//   done      → collapses to a one-line `result` summary with a ✓ tick
// A coloured rail on the left ties the card to its agent's accent everywhere.

import { motion } from "framer-motion";
import { cn } from "./agent-cn";
import { metaFor, resultSummary } from "./agent-meta";
import type { RenderStep } from "./agent-replay";

function Spinner({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15"
      style={{ borderTopColor: color }}
    />
  );
}

function Tick({ color }: { color: string }) {
  return (
    <motion.span
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold text-ink-900"
      style={{ background: color }}
    >
      ✓
    </motion.span>
  );
}

export function AgentStepCard({ step, active }: { step: RenderStep; active: boolean }) {
  const meta = metaFor(step.agent);
  const isThinking = step.phase === "thinking";
  const isStreaming = step.phase === "streaming";
  const isDone = step.phase === "done";

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: -14, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border bg-ink-800/70 backdrop-blur-md",
        "border-white/5 px-3.5 py-3.5 shadow-[0_2px_18px_-10px_rgba(0,0,0,0.9)]",
        active && "border-white/15",
      )}
      style={
        active
          ? { boxShadow: `0 0 0 1px ${meta.accent}55, 0 8px 30px -12px ${meta.accent}55` }
          : undefined
      }
    >
      {/* accent rail */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: meta.accent, opacity: isDone ? 0.5 : 1 }}
      />

      <div className="flex items-center gap-2.5">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-base"
          style={{ background: `${meta.accent}1f`, boxShadow: `inset 0 0 0 1px ${meta.accent}33` }}
        >
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-white/90">{step.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              {step.latencyMs != null && (
                <span className="font-mono text-[10px] text-white/35">{step.latencyMs}ms</span>
              )}
              {isDone ? (
                <Tick color={meta.accent} />
              ) : (
                <Spinner color={meta.accent} />
              )}
            </span>
          </div>
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: `${meta.accent}` }}
          >
            {step.kind === "reasoning" ? "reasoning" : step.kind === "compute" ? "compute" : step.kind}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="mt-2 pl-[38px]">
        {isThinking && (
          <p className="text-[12px] italic text-white/35">thinking…</p>
        )}

        {isStreaming && (
          <p className="text-[12.5px] leading-snug text-white/75">
            {step.typed}
            <span
              className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-blink"
              style={{ background: meta.accent }}
            />
          </p>
        )}

        {isDone && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="break-words text-[12px] leading-relaxed text-white/55"
          >
            <span className="text-white/40">→ </span>
            <span className="font-mono text-[11.5px] text-white/70">
              {resultSummary(step.result) || step.thinking}
            </span>
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
