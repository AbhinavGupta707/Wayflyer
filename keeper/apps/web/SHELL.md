# Keeper web shell (WS7-owned) — integration contract for WS4 / WS5

Next.js 14 App Router · TypeScript · Tailwind · React Query · Framer Motion · Zustand.

## Run

```bash
source ~/.nvm/nvm.sh
cd keeper/apps/web
npm install
npm run dev          # http://localhost:3000
```

Point the client at the mock API with `NEXT_PUBLIC_API_BASE` (default
`http://localhost:8000`). Start the API with:

```bash
cd keeper/apps/api && uvicorn keeper_api.main:app --reload --port 8000
```

## Who owns what

| Path                | Owner | Notes                                   |
|---------------------|-------|-----------------------------------------|
| `app/layout.tsx`, `app/providers.tsx`, `app/page.tsx` | WS7 | Shell — don't edit |
| `lib/*`             | WS7   | Shared client + stores — import, don't fork |
| `app/ops/`          | WS7   | Ops ledger dashboard                    |
| `app/store/`        | WS4   | Customer scene — replace the placeholder |
| `app/agent/`        | WS5   | Agent view — replace the placeholder    |

## The API client — `lib/api.ts`

```ts
import { api, qk, subscribeStream } from "@/lib/api";

const ledger = await api.ledger();                       // LedgerSummary
const rescue = await api.rescue(id);                     // RescueCase
const { rescue_id } = await api.intake({ order_id, variant_id, reason_text, channel });
const resp = await api.respond(id, { accepted: true });  // RespondResponse

// React Query
useQuery({ queryKey: qk.ledger, queryFn: api.ledger });
useQuery({ queryKey: qk.rescue(id), queryFn: () => api.rescue(id) });

// Contract C stream (WS5)
const stop = subscribeStream(id, (ev) => { /* StepEvent | DecisionEvent */ });
```

Types live in `@/lib/types` (mirror of `packages/contracts/types.ts`).

## The scene controller — `lib/scene.ts`

One shared store drives Customer → Agent → Customer.

```ts
import { useScene } from "@/lib/scene";

// WS4 (customer scene): hand off into the agent's mind
const openAgentView = useScene((s) => s.openAgentView);
// onOpenAgentView:
openAgentView(rescueId);

// WS5 (agent view): zoom back out to the customer
const returnToCustomer = useScene((s) => s.returnToCustomer);
// onReturnToCustomer:
returnToCustomer();
```

Read `scene` (`"customer" | "agent"`), `activeRescueId`, and `direction`
(`"forward" | "back"`). The demo shell wraps the two panes in
`<AnimatePresence>` using `agentSceneVariants` / `customerSceneVariants` +
`sceneTransition` for the shared-layout "zoom into the mind" effect.

## The live session counter — `lib/session.ts`

After a successful accept, tick the ops ledger:

```ts
import { useSession } from "@/lib/session";
useSession.getState().recordRespond(resp);  // sums realised margin from resp.actions
```

The ops dashboard subscribes and animates the delta.
