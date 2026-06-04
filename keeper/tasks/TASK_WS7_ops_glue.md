# WS7 — Operator Dashboard & Demo Glue

**Mission:** the Rescue Ledger dashboard + the scene-transition controller that stitches the demo.
**Owns:** `apps/web/app/ops/`, `apps/web/app/layout.tsx`, `apps/web/lib/scene.ts` (transitions), Next.js project config.
**Reads:** Contract A/B/C. Build against mock `GET /api/ledger` + fixtures.

## Build
1. **Bootstrap the Next.js app** (App Router, Tailwind, TS) so WS4/WS5 have a shell to drop pages into.
   Set up `lib/api.ts` (typed client from `packages/contracts/types.ts`) + React Query provider.
2. **Ops dashboard** (`app/ops`): from `GET /api/ledger` (`LedgerSummary`):
   - hero counters: £305,692 size refunds → £182,951 addressable → £108,001 margin → £59,401 realistic.
   - Recharts: recoverable £ by SKU (trainers lead) + by month.
   - live "rescues saved / £ this session" counter that ticks on each `/respond`.
   - SKU intelligence panel: "Court Trainer runs small (56%)" + pending size-chart/supplier drafts.
3. **Scene controller** (`lib/scene.ts`): drives Customer → Agent → Customer transitions (Framer Motion
   `AnimatePresence`, shared-layout "zoom into the agent's mind"). Expose `openAgentView(id)` / `returnToCustomer()`.
4. Wire WS4's `onOpenAgentView` and WS5's `onReturnToCustomer` into the controller.

## Run / verify
```bash
source ~/.nvm/nvm.sh && cd apps/web && npm install && npm run dev
```

## Done =
Dashboard renders the real ledger; the three scenes transition smoothly; counters tick on accept.

## Coordinate
You own the Next.js shell + shared `lib/` + layout — WS4/WS5 drop pages into `app/store` and `app/agent`.
Agree the `lib/api.ts` + scene hook signatures early so the three of you don't block.
