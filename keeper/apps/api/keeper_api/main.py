"""Keeper mock API (Contract B + C).

Serves the real ledger + fixtures so all UI/voice workstreams can build against
a LIVE server on day 0. WS3 later swaps the mock stream for the real agent loop;
WS2 swaps the ledger for live recompute — same endpoints, no contract change.

Run:  cd keeper/apps/api && uvicorn keeper_api.main:app --reload --port 8000
"""
from __future__ import annotations
import asyncio
import json

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .config import CACHE_DIR, FIXTURES_DIR

app = FastAPI(title="Keeper API (mock)", version="0.1.0")
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


@app.websocket("/api/rescue/{rescue_id}/stream")
async def stream(ws: WebSocket, rescue_id: str):
    """Replays the recorded StepEvents with lifelike pacing (mock of the agent loop)."""
    await ws.accept()
    for ev in STREAM:
        if ev.get("kind") != "decision" and ev.get("thinking"):
            await ws.send_json({**ev, "status": "thinking"})
            await asyncio.sleep(0.6)
        await ws.send_json({**ev, "status": ev.get("status", "done")})
        await asyncio.sleep(0.5)
    await ws.close()
