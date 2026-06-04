"use client";

// The replay engine — a queue-driven cinematic animator for the Contract-C
// step stream. One code path drives BOTH offline replay (the fixture is pushed
// in all at once) and the live socket (events are pushed as they arrive over
// `subscribeStream`). For each event it:
//   1. drops in a step card in `thinking` state and lights the swarm edge,
//   2. types the `thinking` text (slow for `reasoning`, a fast flash for
//      `compute`) into the card + the live console,
//   3. settles the one-line `result` and ticks the card to `done`.
// The terminal DecisionEvent flips `decision`, which the view renders big.

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DecisionEvent, StepEvent, StreamEvent } from "@/lib/types";
import { edgeId } from "./agent-meta";

export type StepPhase = "thinking" | "streaming" | "done";

export interface RenderStep {
  seq: number;
  agent: string;
  label: string;
  kind: StepEvent["kind"];
  latencyMs: number | null;
  thinking: string; // full text
  typed: string; // progressively revealed
  result: Record<string, unknown> | null;
  nodeEdge: [string, string] | null;
  phase: StepPhase;
}

export interface ConsoleLine {
  id: number;
  agent: string;
  kind: StepEvent["kind"];
  text: string;
  done: boolean;
}

export type PlayStatus = "idle" | "playing" | "done";

export interface StreamState {
  steps: RenderStep[];
  console: ConsoleLine[];
  decision: DecisionEvent | null;
  activeNode: string | null; // node currently "thinking"
  activeEdge: string | null; // edge currently firing
  litEdges: string[]; // edges already traversed
  visited: string[]; // nodes already settled
  status: PlayStatus;
}

function initialState(): StreamState {
  return {
    steps: [],
    console: [],
    decision: null,
    activeNode: null,
    activeEdge: null,
    litEdges: [],
    visited: [],
    status: "idle",
  };
}

// Timing knobs — paced for a presenter to narrate each step out loud.
const PER_CHAR_REASONING = 26; // ms/char while a reasoning agent streams
const PER_CHAR_COMPUTE = 8; // ms/char — compute steps flash
const SPINNER_REASONING = 560; // ms of spinner before tokens start
const SPINNER_COMPUTE = 340;
const SETTLE_REASONING = 680; // ms pause after result before next step (room to talk)
const SETTLE_COMPUTE = 380;
const DECISION_SUSPENSE = 850;

function isDecision(ev: StreamEvent): ev is DecisionEvent {
  return ev.kind === "decision";
}

export interface AgentStream {
  state: StreamState;
  /** Reset, then play an entire array of events (offline fixture). */
  playAll: (events: StreamEvent[]) => void;
  /** Reset, then drain events as they are fed (live socket). */
  begin: () => { feed: (ev: StreamEvent) => void; end: () => void };
  reset: () => void;
}

export function useAgentStream(): AgentStream {
  // The animation mutates a single state object held in a ref and pings React
  // with a version bump. Char-by-char setState on a normal useState would churn
  // the whole tree through reconciliation on every keystroke; this keeps it cheap.
  const ref = useRef<StreamState>(initialState());
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const commit = useCallback(() => bump(), []);

  const runRef = useRef(0); // increments on reset → cancels the in-flight driver
  const drivingRef = useRef(false);
  const endedRef = useRef(false);
  const queueRef = useRef<StreamEvent[]>([]);

  const reset = useCallback(() => {
    runRef.current += 1;
    drivingRef.current = false;
    endedRef.current = false;
    queueRef.current = [];
    ref.current = initialState();
    commit();
  }, [commit]);

  // ---- low-level animation primitives ------------------------------------

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const raf = () =>
    new Promise<void>((r) =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(() => r())
        : setTimeout(r, 16),
    );

  const updateStep = (seq: number, patch: Partial<RenderStep>) => {
    const s = ref.current;
    s.steps = s.steps.map((st) => (st.seq === seq ? { ...st, ...patch } : st));
  };
  const updateConsole = (id: number, patch: Partial<ConsoleLine>) => {
    const s = ref.current;
    s.console = s.console.map((l) => (l.id === id ? { ...l, ...patch } : l));
  };

  const animateEvent = useCallback(
    async (ev: StreamEvent, myRun: number) => {
      const s = ref.current;

      if (isDecision(ev)) {
        s.activeNode = null;
        s.activeEdge = null;
        commit();
        await sleep(DECISION_SUSPENSE);
        if (myRun !== runRef.current) return;
        ref.current.decision = ev;
        ref.current.status = "done";
        commit();
        return;
      }

      const step = ev as StepEvent;
      const eid = edgeId(step.node_edge ?? null);
      const target = step.node_edge?.[1] ?? step.agent;

      // 1) card appears, edge fires, console line opens
      const render: RenderStep = {
        seq: step.seq,
        agent: step.agent,
        label: step.label,
        kind: step.kind,
        latencyMs: step.latency_ms ?? null,
        thinking: step.thinking ?? "",
        typed: "",
        result: null,
        nodeEdge: step.node_edge ?? null,
        phase: "thinking",
      };
      const lineId = step.seq;
      s.steps = [...s.steps, render];
      s.console = [
        ...s.console,
        { id: lineId, agent: step.agent, kind: step.kind, text: "", done: false },
      ];
      // The upstream node of this edge (e.g. "intake") is already complete the
      // moment its edge fires — mark it visited so it lights up too.
      const source = step.node_edge?.[0] ?? null;
      if (source && !s.visited.includes(source)) s.visited = [...s.visited, source];
      s.activeEdge = eid;
      s.activeNode = target;
      s.status = "playing";
      commit();

      await sleep(step.kind === "compute" ? SPINNER_COMPUTE : SPINNER_REASONING);
      if (myRun !== runRef.current) return;

      // 2) stream the thinking text
      updateStep(step.seq, { phase: "streaming" });
      commit();
      const text = render.thinking;
      const perChar = step.kind === "compute" ? PER_CHAR_COMPUTE : PER_CHAR_REASONING;
      const chunk = step.kind === "compute" ? 3 : 1;
      let i = 0;
      let lastPaint = -1;
      while (i < text.length) {
        if (myRun !== runRef.current) return;
        i = Math.min(text.length, i + chunk);
        const slice = text.slice(0, i);
        updateStep(step.seq, { typed: slice });
        updateConsole(lineId, { text: slice });
        commit();
        // pace the reveal without sleeping per single char on long strings
        await sleep(perChar * chunk);
        lastPaint = i;
      }
      if (lastPaint !== text.length) {
        updateStep(step.seq, { typed: text });
        updateConsole(lineId, { text });
      }

      // 3) settle result, tick to done, leave a lit edge behind
      if (myRun !== runRef.current) return;
      updateStep(step.seq, { phase: "done", result: step.result ?? null });
      updateConsole(lineId, { done: true });
      if (eid && !ref.current.litEdges.includes(eid)) {
        ref.current.litEdges = [...ref.current.litEdges, eid];
      }
      if (!ref.current.visited.includes(target)) {
        ref.current.visited = [...ref.current.visited, target];
      }
      ref.current.activeEdge = null;
      commit();

      await sleep(step.kind === "compute" ? SETTLE_COMPUTE : SETTLE_REASONING);
    },
    [commit],
  );

  const drive = useCallback(
    async (myRun: number) => {
      if (drivingRef.current) return;
      drivingRef.current = true;
      while (myRun === runRef.current) {
        const ev = queueRef.current.shift();
        if (!ev) {
          if (endedRef.current) {
            if (ref.current.status === "playing") {
              ref.current.status = "done";
              commit();
            }
            break;
          }
          await raf(); // live mode: idle until the next frame arrives
          continue;
        }
        await animateEvent(ev, myRun);
      }
      if (myRun === runRef.current) drivingRef.current = false;
    },
    [animateEvent, commit],
  );

  const playAll = useCallback(
    (events: StreamEvent[]) => {
      reset();
      const myRun = runRef.current;
      queueRef.current = [...events];
      endedRef.current = true;
      ref.current.status = "playing";
      commit();
      void drive(myRun);
    },
    [reset, drive, commit],
  );

  const begin = useCallback(() => {
    reset();
    const myRun = runRef.current;
    ref.current.status = "playing";
    commit();
    void drive(myRun);
    return {
      feed: (ev: StreamEvent) => {
        if (myRun !== runRef.current) return;
        queueRef.current.push(ev);
      },
      end: () => {
        if (myRun !== runRef.current) return;
        endedRef.current = true;
      },
    };
  }, [reset, drive, commit]);

  // Cancel any in-flight animation if the component unmounts.
  useEffect(() => () => void (runRef.current += 1), []);

  return { state: ref.current, playAll, begin, reset };
}
