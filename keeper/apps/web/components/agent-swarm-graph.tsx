"use client";

// The swarm: fixed pipeline of agent nodes (intake → … → concierge) laid out as
// a vertical spine. As each StepEvent fires, its `node_edge` lights up — the
// travelling edge animates, the target node pulses, settled nodes stay lit.
// Pure presentation: it reads activeNode / activeEdge / litEdges / visited off
// the replay engine. No interaction (drag/zoom disabled) — it's a viz, not a canvas.

import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { AGENT_META, NODE_ORDER, metaFor } from "./agent-meta";

type NodeStatus = "pending" | "active" | "visited";
interface SwarmNodeData {
  label: string;
  icon: string;
  accent: string;
  status: NodeStatus;
}

function SwarmNode({ data }: NodeProps<SwarmNodeData>) {
  const { accent, status } = data;
  const active = status === "active";
  const visited = status === "visited";
  return (
    <div
      className="relative flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 transition-all duration-300"
      style={{
        background: active
          ? `${accent}26`
          : visited
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.015)",
        borderColor: active ? accent : visited ? `${accent}59` : "rgba(255,255,255,0.07)",
        boxShadow: active ? `0 0 22px -2px ${accent}, inset 0 0 0 1px ${accent}` : "none",
        opacity: status === "pending" ? 0.45 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      {active && (
        <span
          className="absolute -inset-px rounded-full"
          style={{ animation: "swarm-ping 1.5s ease-out infinite", boxShadow: `0 0 0 0 ${accent}` }}
        />
      )}
      <span
        className="grid h-6 w-6 place-items-center rounded-full text-sm"
        style={{ background: `${accent}26` }}
      >
        {data.icon}
      </span>
      <span
        className="pr-1 text-[12px] font-medium"
        style={{ color: active ? "#fff" : visited ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)" }}
      >
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { swarm: SwarmNode };

export function AgentSwarmGraph({
  activeNode,
  activeEdge,
  litEdges,
  visited,
}: {
  activeNode: string | null;
  activeEdge: string | null;
  litEdges: string[];
  visited: string[];
}) {
  const baseNodes = useMemo<Node<SwarmNodeData>[]>(
    () =>
      NODE_ORDER.map((id, i) => {
        const meta = AGENT_META[id];
        return {
          id,
          type: "swarm",
          position: { x: 0, y: i * 78 },
          data: { label: meta.label, icon: meta.icon, accent: meta.accent, status: "pending" },
          draggable: false,
          selectable: false,
        };
      }),
    [],
  );

  const baseEdges = useMemo<Edge[]>(
    () =>
      NODE_ORDER.slice(0, -1).map((from, i) => {
        const to = NODE_ORDER[i + 1];
        return {
          id: `${from}->${to}`,
          source: from,
          target: to,
          type: "smoothstep",
        };
      }),
    [],
  );

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => {
        const status: NodeStatus =
          n.id === activeNode ? "active" : visited.includes(n.id) ? "visited" : "pending";
        return { ...n, data: { ...n.data, status } };
      }),
    [baseNodes, activeNode, visited],
  );

  const edges = useMemo(
    () =>
      baseEdges.map((e) => {
        const isActive = e.id === activeEdge;
        const isLit = litEdges.includes(e.id);
        const accent = metaFor(e.target).accent;
        return {
          ...e,
          animated: isActive,
          style: {
            stroke: isActive ? accent : isLit ? `${accent}aa` : "rgba(255,255,255,0.08)",
            strokeWidth: isActive ? 2.5 : isLit ? 1.75 : 1,
            transition: "stroke 0.3s",
          },
        };
      }),
    [baseEdges, activeEdge, litEdges],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.05)" />
      </ReactFlow>
    </div>
  );
}
