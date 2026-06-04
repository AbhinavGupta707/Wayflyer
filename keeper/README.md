# Keeper — turn a return into a kept sale

Agentic returns operating system for **Pretty Fly** (Wayflyer × Fin hackathon).
It intercepts a return at the moment of intent, decides the highest-margin save
(**exchange > refund**) from grounded customer + SKU + inventory + margin data,
executes it across chat/voice, and feeds the learning upstream (size-chart,
buying team, supplier). Proven by an **LLM-free backtest over 5,843 real refunds.**

## The proof number (reproducible, point-in-time stock, zero LLM)
```
£305,692  size-driven refunds (2,393 of 5,843)
£182,951  addressable by an in-stock exchange AT REFUND TIME (1,382)
£108,001  margin retained (discount-adjusted, net of swap cost)
£ 59,401  realistic margin @ 55% acceptance
Top offenders: Court / Mid Runner / Canvas / Tech Runner Trainers (trainers run small)
```
Regenerate any time: `cd apps/api && python -m keeper_api.engine.backtest`

## Quickstart
```bash
# 1. Feature stores + ledger + fixture (stdlib only, ~10s)
cd keeper/apps/api
python3 -m keeper_api.engine.backtest      # -> cache/ledger.json
python3 -m keeper_api.etl.build            # -> cache/{passports,genomes,stock_timeline}.json + fixtures/rescue_case.json

# 2. Mock API (serves real ledger + fixtures for all UI/voice work)
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt            # core deps suffice for the mock
uvicorn keeper_api.main:app --reload --port 8000
#   GET  /api/health  /api/ledger  /api/catalog  /api/rescue/{id}
#   POST /api/returns/intake  /api/rescue/{id}/respond
#   WS   /api/rescue/{id}/stream   (replays fixtures/step_stream.json)

# 3. Web (after Node ready: `source ~/.nvm/nvm.sh`)
cd ../web && npm install && npm run dev     # http://localhost:3000
```

## Layout
```
keeper/
  packages/contracts/   FROZEN contracts — schemas.py (Pydantic) + types.ts  [Contract A/B/C]
  apps/api/keeper_api/
    etl/build.py        passports + genomes + stock timeline  (WS1)
    engine/decision.py  deterministic decision engine          (WS2)
    engine/backtest.py  the Rescue Ledger (proof)              (WS2)
    agents/             LangGraph swarm + Fireworks            (WS3)
    voice/              ElevenLabs + Twilio                    (WS6)
    main.py             mock API (Contract B + C)
  apps/web/app/
    store/  agent/  ops/   customer UI / agent view / dashboard (WS4/5/7)
  fixtures/             rescue_case.json, step_stream.json, ledger.sample.json
  cache/                generated (gitignored)
  tasks/                TASK_WS1..7.md  — the parallel launch briefs
  IMPLEMENTATION_PLAN.md  CONTRACTS.md
```

See `IMPLEMENTATION_PLAN.md` for the parallelization map and `tasks/` for per-agent briefs.
