"""Keeper API (Contract B + C) — integrated.

Endpoints serve the real ledger + fixtures; the WS stream runs the live WS3
agent swarm (falls back to the recorded stream so the demo is never dark).

  GET  /api/health  /api/ledger  /api/catalog  /api/rescue/{id}
  POST /api/returns/intake  /api/rescue/{id}/respond
  WS   /api/rescue/{id}/stream
  +    WS6 voice routes (mounted defensively)

Run:  cd keeper/apps/api && uvicorn keeper_api.main:app --reload --port 8000
"""
from __future__ import annotations
import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import CACHE_DIR, FIXTURES_DIR

app = FastAPI(title="Keeper API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


def _read(path, default):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default


RESCUE = _read(FIXTURES_DIR / "rescue_case.json", {})
STREAM = _read(FIXTURES_DIR / "step_stream.json", [])
LEDGER = _read(FIXTURES_DIR / "ledger.sample.json", _read(CACHE_DIR / "ledger.json", {}).get("summary", {}))
GENOMES = _read(CACHE_DIR / "genomes.json", {})


@app.get("/api/health")
def health():
    return {"ok": True, "fixtures": bool(RESCUE), "stream_steps": len(STREAM)}


@app.get("/api/ledger")
def ledger():
    # WS2: recompute live from the data (memoised). Falls back to the fixture
    # if the data dir isn't available in this environment.
    try:
        from .engine.backtest import live_summary
        return live_summary()
    except Exception:
        return LEDGER


@app.get("/api/catalog")
def catalog():
    return list(GENOMES.values())


@app.get("/api/rescue/{rescue_id}")
def rescue(rescue_id: str):
    return RESCUE


@app.post("/api/returns/intake")
def intake(body: dict):
    return {"rescue_id": RESCUE.get("rescue_id", "rsc_demo_0001")}


@app.post("/api/rescue/{rescue_id}/respond")
def respond(rescue_id: str, body: dict):
    accepted = bool(body.get("accepted"))
    if accepted:
        return {
            "actions": [a for e in STREAM if e.get("kind") == "decision"
                        for a in e.get("actions_preview", [])],
            "confirmation": "Exchange created — UK8 ships today, prepaid label sent for the UK7s. "
                            "Refund cancelled. Size guidance updated.",
        }
    return {"actions": [], "confirmation": "Refund processed."}


# --- WS6 voice routes (ElevenLabs widget + Twilio call). Defensive: never block
#     API boot if telephony deps/keys are absent — the module degrades gracefully.
try:
    from .voice import router as voice_router
    app.include_router(voice_router)
except Exception as _voice_err:  # pragma: no cover
    logging.getLogger(__name__).warning("voice routes not mounted: %s", _voice_err)


async def _replay_recorded(ws: WebSocket) -> None:
    """Fallback: replay the canonical recording (only if the live loop errors)."""
    for ev in STREAM:
        if ev.get("kind") != "decision" and ev.get("thinking"):
            await ws.send_json({**ev, "status": "thinking"})
            await asyncio.sleep(0.6)
        await ws.send_json({**ev, "status": ev.get("status", "done")})
        await asyncio.sleep(0.5)


@app.websocket("/api/rescue/{rescue_id}/stream")
async def stream(ws: WebSocket, rescue_id: str):
    """Run the real WS3 agent swarm and stream Contract-C StepEvents.

    Falls back to the recorded stream if the live loop fails, so the demo is
    never dark (e.g. when FIREWORKS_API_KEY isn't set).
    """
    await ws.accept()
    channel = ws.query_params.get("channel", "voice")
    try:
        from .agents import astream_events
        async for ev in astream_events(rescue_id, channel):
            await ws.send_json(ev)
            await asyncio.sleep(0.04 if ev.get("status") == "streaming" else 0.18)
    except WebSocketDisconnect:
        return
    except Exception as err:  # pragma: no cover — keep the demo alive
        logging.getLogger(__name__).exception("live agent loop failed: %s", err)
        try:
            await _replay_recorded(ws)
        except WebSocketDisconnect:
            return
    await ws.close()
