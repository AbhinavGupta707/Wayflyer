# WS2 — Decision Engine & Rescue Ledger  ★ (start first — the proof)

**Mission:** the deterministic brain + the LLM-free backtest that produces the headline £.
**Owns:** `apps/api/keeper_api/engine/`  (`decision.py`, `backtest.py`)
**Reads:** Contract A, raw CSVs.

## Current state (already working)
`python3 -m keeper_api.engine.backtest` →
`£305,692 size refunds → £182,951 addressable → £108,001 margin → £59,401 realistic @55%`, trainers top.
The 6 fixes are in: reason-router, inventory-aware (point-in-time), discount-adjusted margin, swap cost,
store-credit excluded, addressable-vs-realistic.

## Build (harden + expose)
1. Add `live_decide(rescue_case) -> Decision` wrapper used by the agent loop (same logic, live stock).
2. Refine economics if time: discount-adjusted realised price from `line_items.price/total_discount`;
   conditional swap-return risk for "runs small" SKUs.
3. Wire `GET /api/ledger` to **recompute live** (replace the fixture read in `main.py`).
4. Add `by_reason` and `recoverable_lost_to_stockout` (size returns where the alt was OOS at the time —
   that gap is an inventory insight worth ~£Xk).
5. Unit test: assert the ledger totals are stable run-to-run (reproducibility = the credibility moat).

## Done =
`/api/ledger` returns a live-recomputed `LedgerSummary`; `live_decide` returns Contract-A `Decision`; totals reproducible.

## Don't touch
`etl/` internals, `apps/web/`, contract files (extend ledger fields only additively).
