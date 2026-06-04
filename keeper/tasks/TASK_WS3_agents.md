# WS3 — Agent Swarm (LangGraph + Fireworks OSS)

**Mission:** the live agent loop that hydrates a rescue, runs the swarm, and **streams Contract-C events**.
**Owns:** `apps/api/keeper_api/agents/`
**Reads:** Contract A + C, `fixtures/rescue_case.json`, `engine/decision.py` (WS2), `features.py` (WS1 — mock until ready).

## Build
1. `graph.py` — LangGraph state graph with nodes:
   `triage → context → fit → inventory → economics → governor → concierge → (decision)`.
   - Deterministic nodes (context/fit/inventory/economics/governor) call WS2/WS1 — **no LLM, emit `compute` StepEvents**.
   - LLM nodes (triage, concierge, learning) call **Fireworks** and **emit `reasoning` StepEvents** (stream `thinking`).
2. `llm.py` — `ChatFireworks` wrappers:
   - triage → `accounts/fireworks/models/llama-v3p1-8b-instruct`
   - tool/structured → FireFunction-V2
   - concierge/drafting → `llama-v3p3-70b-instruct` (DeepSeek-V3 alt)
   **Rule: the LLM never invents numbers/offers — it phrases the engine's decision.**
3. Map LangGraph streaming → `StepEvent`/`DecisionEvent`; replace the mock WS handler in `main.py`
   (`/api/rescue/{id}/stream`) with the real loop. Output MUST match `fixtures/step_stream.json` shape.
4. `learning` node: when a SKU crosses a return-skew threshold, draft size-chart patch + buying flag + supplier note (real artifacts).

## Run / verify
```bash
export FIREWORKS_API_KEY=...
cd apps/api && python3 -c "from keeper_api.agents.graph import run_demo; run_demo('rsc_demo_0001')"
```
Stream must replay the Court Trainer case end-to-end and end with an `exchange` DecisionEvent.

## Done =
WS endpoint streams real StepEvents (WS5 renders them unchanged); decision == engine's decision.

## Don't touch
`apps/web/`, `etl/`, `engine/decision.py` logic (call it, don't fork it), contract field shapes.
