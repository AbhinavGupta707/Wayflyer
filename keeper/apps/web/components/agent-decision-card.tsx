"use client";

// The payoff. When the terminal DecisionEvent lands, this card rises over the
// console and lays out the money the deterministic engine computed:
//   refund −£162.50  vs  exchange +£87.62 margin  (recover £162.50).
// Below it, the queued ActionObjects (real vs simulated, one-tap approval), and
// the "Return to Customer View" button that fires onReturnToCustomer().

import { motion } from "framer-motion";
import { gbpPence } from "@/lib/format";
import type { ActionObject, DecisionEvent } from "@/lib/types";
import { cn } from "./agent-cn";

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  create_exchange: { label: "Create exchange", icon: "🔁" },
  reserve_inventory: { label: "Reserve inventory", icon: "📦" },
  process_refund: { label: "Process refund", icon: "↩️" },
  issue_store_credit: { label: "Issue store credit", icon: "🎟️" },
  make_voice_call: { label: "Place voice call", icon: "📞" },
  send_message: { label: "Send message", icon: "✉️" },
  create_waitlist: { label: "Add to waitlist", icon: "⏳" },
  publish_size_chart_patch: { label: "Patch size chart", icon: "📏" },
  flag_to_buying: { label: "Flag to buying", icon: "🚩" },
  draft_supplier_note: { label: "Draft supplier note", icon: "📝" },
  update_memory: { label: "Update memory", icon: "🧠" },
};

function payloadLine(a: ActionObject): string {
  const p = a.payload ?? {};
  const bits = Object.entries(p).map(([k, v]) => `${k}: ${String(v)}`);
  return bits.join(" · ");
}

function ActionRow({ action }: { action: ActionObject }) {
  const meta = ACTION_LABELS[action.action_type] ?? { label: action.action_type, icon: "•" };
  const margin = action.expected_margin_impact ?? 0;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg border border-white/5 bg-ink-800/60 px-3 py-2"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/5 text-sm">
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-white/85">{meta.label}</span>
          <span
            className={cn(
              "rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
              action.real
                ? "bg-mint-500/15 text-mint-400"
                : "bg-white/5 text-white/40",
            )}
          >
            {action.real ? "real" : "sim"}
          </span>
          {action.requires_approval && (
            <span className="rounded bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-400">
              approve
            </span>
          )}
        </div>
        {payloadLine(action) && (
          <span className="truncate font-mono text-[10.5px] text-white/40">{payloadLine(action)}</span>
        )}
      </div>
      {margin > 0 && (
        <span className="shrink-0 font-mono text-[12px] font-semibold text-mint-400">
          +{gbpPence(margin)}
        </span>
      )}
    </motion.li>
  );
}

export function AgentDecisionCard({
  event,
  onReturnToCustomer,
}: {
  event: DecisionEvent;
  onReturnToCustomer: () => void;
}) {
  const d = event.decision;
  const isExchange = d.action === "exchange";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="relative overflow-hidden rounded-2xl border border-mint-500/30 bg-ink-800/85 p-5 backdrop-blur-xl"
      style={{ boxShadow: "0 0 0 1px rgba(16,185,129,0.18), 0 24px 60px -24px rgba(16,185,129,0.45)" }}
    >
      {/* sheen sweep */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px ag-sheen" />

      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint-500/20 text-lg">
          {isExchange ? "🔁" : d.action === "refund" ? "↩️" : "⏳"}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold capitalize text-white">
              {d.action}
              {d.to_size ? ` → ${d.to_size}` : ""}
            </h2>
            <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/45">
              {d.branch}
            </span>
            {d.requires_approval && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                one-tap approval
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-white/55">{d.rationale}</p>
        </div>
      </div>

      {/* the £ math */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-3">
          <span className="text-[10px] uppercase tracking-wider text-red-300/70">If we refund</span>
          <div className="mt-1 font-mono text-xl font-bold text-red-300">
            −{gbpPence(d.recovered_gbp)}
          </div>
          <span className="text-[11px] text-white/40">sale lost, margin gone</span>
        </div>
        <div
          className="rounded-xl border border-mint-500/30 bg-mint-500/10 p-3"
          style={{ boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.15)" }}
        >
          <span className="text-[10px] uppercase tracking-wider text-mint-400/80">If we exchange</span>
          <div className="mt-1 font-mono text-xl font-bold text-mint-400">
            +{gbpPence(d.margin_gbp)}
          </div>
          <span className="text-[11px] text-white/45">
            sale kept · {gbpPence(d.recovered_gbp)} recovered
          </span>
        </div>
      </div>

      {/* margin breakdown — make the £ self-explanatory */}
      {isExchange && d.margin_gbp > 0 && (
        <div className="mt-2 text-center font-mono text-[11px] text-white/45">
          {gbpPence(d.recovered_gbp)} sale − {gbpPence(Math.max(0, d.recovered_gbp - d.margin_gbp - 5))} cost − {gbpPence(5)} swap ={" "}
          <span className="font-semibold text-mint-400">{gbpPence(d.margin_gbp)} kept</span>
        </div>
      )}

      {/* swing callout */}
      <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-white/[0.03] py-2 text-[12px]">
        <span className="text-white/45">Better than refunding by</span>
        <span className="font-mono font-semibold text-mint-400">
          {gbpPence(d.margin_gbp + d.recovered_gbp)}
        </span>
      </div>

      {/* actions */}
      <div className="mt-4">
        <span className="text-[10px] uppercase tracking-wider text-white/35">
          Actions queued ({event.actions_preview.length})
        </span>
        <ul className="mt-2 space-y-1.5">
          {event.actions_preview.map((a, i) => (
            <ActionRow key={`${a.action_type}-${i}`} action={a} />
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onReturnToCustomer}
        className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-mint-500 py-3 text-[13px] font-semibold text-ink-900 transition-all hover:bg-mint-400 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.7)]"
      >
        Return to Customer View
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </button>
    </motion.div>
  );
}
