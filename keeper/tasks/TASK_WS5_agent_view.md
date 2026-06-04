# WS5 — Agent View (the reasoning console)

**Mission:** the cinematic "AI reasoning" screen — step cards + swarm graph + typewriter, ending in a decision.
**Owns:** `apps/web/app/agent/` (+ `components/agent-*`)
**Reads:** Contract C only. Build entirely against `fixtures/step_stream.json` (no backend needed),
then swap to `WS /api/rescue/{id}/stream`.

## Build
1. Next.js + Framer Motion + React Flow (xyflow).
2. Layout:
   - **Left:** vertical timeline of **step cards** (one per `StepEvent`). Each: agent icon + `label`,
     spinner while `status:thinking` → typewriter streams `thinking` → collapses to a one-line `result` → ✓.
   - **Center:** **swarm graph** (React Flow) with fixed nodes (triage→context→fit→inventory→economics→governor→concierge);
     light up the edge in `node_edge` as each step fires.
   - **Bottom:** live console echoing the streamed `thinking` (monospace).
   - `compute` steps = fast flash + result; `reasoning` steps = stream tokens.
3. On the terminal `DecisionEvent`: render a prominent **Decision card** (offer + the £ math:
   refund −£162.50 vs exchange +£87.62 margin) + the `actions_preview` list + a **"Return to Customer View"** button.
4. Aesthetic: dark, glassmorphism, accent pulse on active node, subtle grid/particles.
   **Refs:** Perplexity steps, Claude thinking panel, LangGraph Studio, v0/Cursor agent streams.

## Run / verify
A "Replay" button that feeds `fixtures/step_stream.json` through the same renderer (works offline).

## Done =
Plays the 8-event Court Trainer stream beautifully and emits an `onReturnToCustomer()` callback.

## Don't touch
`app/store/`, `app/ops/`, backend, contract files.
