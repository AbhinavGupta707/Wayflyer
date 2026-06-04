# Keeper — Frozen Contracts (interface reference)

Source of truth: `packages/contracts/schemas.py` (Pydantic) + `packages/contracts/types.ts` (TS).
**Do not change a field without updating both files + notifying all workstreams.**

## Contract A — domain / feature store
`Passport`, `SkuGenome`, `RescueCase` (+ `ReturnedItem`, `Sibling`, `Economics`, `ExchangeOption`),
`Decision`, `ActionObject` (+ `ActionType`). See real instances in `fixtures/rescue_case.json` and `cache/`.

## Contract B — API (mock today, real after WS2/WS3)
| Method | Path | Body → Response |
|--------|------|-----------------|
| GET | `/api/health` | → `{ok, fixtures, stream_steps}` |
| GET | `/api/ledger` | → `LedgerSummary` |
| GET | `/api/catalog` | → `SkuGenome[]` |
| GET | `/api/rescue/{id}` | → `RescueCase` |
| POST | `/api/returns/intake` | `ReturnIntakeRequest` → `RescueIdResponse` |
| POST | `/api/rescue/{id}/respond` | `RespondRequest` → `RespondResponse` |
| WS | `/api/rescue/{id}/stream` | → stream of `StepEvent` … `DecisionEvent` |

## Contract C — agent step-event stream
`StepEvent { seq, agent, label, kind: reasoning|compute|tool|decision, status: thinking|streaming|done,
thinking?, result?, node_edge?, latency_ms? }` then a terminal
`DecisionEvent { seq, kind:"decision", decision: Decision, actions_preview: ActionObject[] }`.
Canonical recording: `fixtures/step_stream.json` (8 events for the Court Trainer case).

**Rendering rule (WS5):** `thinking` drives the typewriter; `node_edge` lights the swarm graph;
`compute` steps flash a fast result, `reasoning` steps stream tokens.

## The hard rule
The LLM (OSS via Fireworks) controls **words** — interpreting input, conversation, drafting prose.
Deterministic code (`engine/decision.py`) controls **every number and every decision**.
The backtest/ledger therefore uses **no LLM** and is reproducible to the penny.
