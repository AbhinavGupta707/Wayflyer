# WS4 — Customer Storefront & Return Flow

**Mission:** a beautiful streetwear storefront + return flow that hands off to the agent view and back.
**Owns:** `apps/web/app/store/` (+ shared `apps/web/lib/`, `apps/web/components/` — namespace your files `store-*`)
**Reads:** Contract B (API) + Contract A. Build against the mock API at `http://localhost:8000`.

## Build
1. Next.js + Tailwind + shadcn/ui. Aesthetic: monochrome, bold oversized type, generous whitespace,
   grid. **Design refs:** END. Clothing, SSENSE, Aimé Leon Dore, Represent; Loop Returns (return UX).
2. Pages/components:
   - storefront grid from `GET /api/catalog`; product cards (`ProductCard`).
   - account → order history (mock order from the rescue fixture) → **"Return / exchange"**.
   - `ReasonChips` (Too small / Too large / Changed mind / Quality / Damaged) + optional text.
   - submit → `POST /api/returns/intake` → **modal "✨ Open Agent View"** (this is the handoff).
   - after agent view returns: `OfferCard` (the exchange offer) + `VoiceCTA`; accept → `POST /respond` → `ConfirmationScreen`.
3. Images: use `apps/web/public/` heroes (WS-side task generates with Flux/SDXL on Fireworks) OR monochrome typographic cards.
4. Scene transition to/from `/agent` is owned by WS7 glue — expose a `onOpenAgentView(rescueId)` hook.

## Run / verify
```bash
source ~/.nvm/nvm.sh && cd apps/web && npm install && npm run dev   # :3000  (api on :8000)
```

## Done =
Full click-path works on the mock API: browse → return → reason → "Open Agent View" → (returns) → offer → confirm.

## Don't touch
`app/agent/`, `app/ops/`, the `apps/api/` backend, contract files.
