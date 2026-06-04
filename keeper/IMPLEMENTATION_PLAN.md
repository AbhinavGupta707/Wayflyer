# Keeper — Implementation Plan & Parallelization Map

## Principle: contract-first → 7-way parallel fan-out
Day-0 (this scaffold) froze the 3 contracts + materialised real data + fixtures, so
**all 7 workstreams now build concurrently against mocks**, with a short integration phase.

```
DONE (Day-0 scaffold)            PARALLEL (launch all 7 now)         INTEGRATION (serial, last)
✓ contracts (schemas.py/ts)      WS1 Data/ETL    WS5 Agent view      • WS1 features -> WS3
✓ real ledger £108k margin       WS2 Engine ★    WS6 Voice           • WS3 real stream -> WS5
✓ passports/genomes/stock        WS3 Agents      WS7 Ops + glue      • WS2 live ledger -> WS7
✓ rescue_case + step_stream      WS4 Customer UI                     • e2e demo run-through
✓ mock API (11 routes)
```

## Workstream map
| WS | Owns (dir) | Depends (contract) | Builds against | Done = |
|----|-----------|--------------------|----------------|--------|
| WS1 | `apps/api/keeper_api/etl/` | A | raw CSVs | `passport(id)`/`genome(id)`/`stock_at()` accessors + parquet cache |
| WS2 ★ | `apps/api/keeper_api/engine/` | A | raw CSVs | engine hardened + `/api/ledger` live recompute (= £108k) |
| WS3 | `apps/api/keeper_api/agents/` | A,C | `fixtures/rescue_case.json` | LangGraph swarm streams real `StepEvent`s over the WS |
| WS4 | `apps/web/app/store/` | B | mock API :8000 | full storefront + return flow + offer/confirm |
| WS5 | `apps/web/app/agent/` | C | `fixtures/step_stream.json` | reasoning console + swarm graph plays the stream |
| WS6 | `apps/api/keeper_api/voice/` | B | a phone | ElevenLabs widget + real Twilio call speaks the offer |
| WS7 | `apps/web/app/ops/` + glue | A,B,C | mock `/api/ledger` | dashboard + counters + scene transitions |

★ = start first; it's the business-value proof.

## The two true serialization points
1. **Day-0 contracts** — done (this commit).
2. **Integration** — wire real feature store into WS3, real agent stream into WS5, live ledger into WS7, then a full demo run-through.

Everything else is concurrent. Each agent owns a **separate directory** → no merge collisions.

## Demo choreography (the flow every UI must support)
1. Customer view (storefront) → order history → "Return / exchange" the Court Trainer (UK7).
2. Reason chips (Too small / …) + optional text → `POST /returns/intake` → popup **"Open Agent View"**.
3. Transition → **Agent View**: subscribe `WS /rescue/{id}/stream`; render step cards + swarm graph + typewriter thinking.
4. Decision card → button **"Return to Customer View"**.
5. Back to customer view → trigger the action (voice call / chat offer) → accept → `POST /respond` → confirmation; ledger counter ticks.

## Setup notes for parallel sessions
- **Python/ETL/engine/agents:** stdlib runs ETL+backtest with zero installs; `pip install -r apps/api/requirements.txt` for API/agents/voice.
- **Node/web:** `source ~/.nvm/nvm.sh` to get Node on PATH (installed via nvm), then `cd apps/web && npm install`.
- **Keys (.env):** `FIREWORKS_API_KEY` (WS3 — OSS models, no frontier API), `ELEVENLABS_API_KEY`, `TWILIO_*` (WS6).
- **Models (WS3, all OSS on Fireworks):** triage = Llama-3.1-8B; tool/structured = FireFunction-V2; concierge/drafting = Llama-3.3-70B (DeepSeek-V3 alt). LLM controls words only; the engine owns every number.
