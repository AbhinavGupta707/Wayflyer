// Identity for every node in the Keeper swarm — icon, label, accent glow.
// The swarm graph and the step cards both read from here so the colour of an
// agent is the same everywhere. Order matches the Contract-C pipeline:
//   intake -> triage -> context -> fit -> inventory -> economics -> governor -> concierge

export interface AgentMeta {
  id: string;
  label: string;
  icon: string;
  /** Hex accent used for node glow + card rail. */
  accent: string;
}

export const NODE_ORDER = [
  "intake",
  "triage",
  "context",
  "fit",
  "inventory",
  "economics",
  "governor",
  "concierge",
] as const;

export type NodeId = (typeof NODE_ORDER)[number];

export const AGENT_META: Record<string, AgentMeta> = {
  intake: { id: "intake", label: "Intake", icon: "📥", accent: "#64748b" },
  triage: { id: "triage", label: "Triage", icon: "🧭", accent: "#38bdf8" },
  context: { id: "context", label: "Context", icon: "📚", accent: "#818cf8" },
  fit: { id: "fit", label: "Fit", icon: "📐", accent: "#34d399" },
  inventory: { id: "inventory", label: "Inventory", icon: "📦", accent: "#2dd4bf" },
  economics: { id: "economics", label: "Economics", icon: "💷", accent: "#fbbf24" },
  governor: { id: "governor", label: "Governor", icon: "🛡️", accent: "#f59e0b" },
  concierge: { id: "concierge", label: "Concierge", icon: "💬", accent: "#f472b6" },
};

const FALLBACK: AgentMeta = { id: "agent", label: "Agent", icon: "✦", accent: "#34d399" };

export function metaFor(id: string | null | undefined): AgentMeta {
  if (!id) return FALLBACK;
  return AGENT_META[id] ?? { ...FALLBACK, id, label: id };
}

/** Edge id used by both the swarm graph and the replay engine. */
export function edgeId(edge: [string, string] | null | undefined): string | null {
  return edge ? `${edge[0]}->${edge[1]}` : null;
}

/** Human one-liner for a step's `result` object — used on collapsed cards. */
export function resultSummary(result: Record<string, unknown> | null | undefined): string {
  if (!result) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(result)) {
    if (v === null || v === undefined) continue;
    const val =
      typeof v === "number"
        ? Number.isInteger(v)
          ? String(v)
          : v.toFixed(2)
        : typeof v === "boolean"
          ? v ? "yes" : "no"
          : String(v);
    parts.push(`${k.replace(/_/g, " ")}: ${val}`);
  }
  return parts.join("  ·  ");
}
