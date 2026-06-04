"""Contract-C step-event plumbing.

A `StepEmitter` turns LangGraph node activity into the `StepEvent` / `DecisionEvent`
stream that WS5 renders unchanged. One *logical* step owns one `seq`; its
`thinking` -> `streaming` -> `done` lifecycle all share that seq (exactly how the
recorded `fixtures/step_stream.json` and the mock handler behave).

The emitter is transport-agnostic: it pushes plain dicts into an async `sink`
(a WebSocket sender, an asyncio.Queue put, or a list.append for `run_demo`).
"""
from __future__ import annotations

import time
from typing import Awaitable, Callable, Optional

# Best-effort validation against the frozen Pydantic contracts. The contracts
# package lives outside the api import root, so failure to import is non-fatal —
# we still emit correctly-shaped dicts.
try:  # pragma: no cover - import shim
    import sys
    from ..config import REPO_ROOT

    _pkg = str(REPO_ROOT / "keeper" / "packages")
    if _pkg not in sys.path:
        sys.path.insert(0, _pkg)
    from contracts.schemas import StepEvent as _StepEvent  # type: ignore
    from contracts.schemas import DecisionEvent as _DecisionEvent  # type: ignore
except Exception:  # pragma: no cover
    _StepEvent = None
    _DecisionEvent = None


Sink = Callable[[dict], Awaitable[None]]


def _validate(ev: dict) -> dict:
    """Round-trip through the frozen contract model when available (no-op otherwise)."""
    model = _DecisionEvent if ev.get("kind") == "decision" else _StepEvent
    if model is None:
        return ev
    return model.model_validate(ev).model_dump(exclude_none=True)


class Step:
    """One node's lifecycle. Reuses a single `seq` across thinking/streaming/done."""

    def __init__(self, emitter: "StepEmitter", agent: str, label: str, kind: str,
                 node_edge: Optional[list[str]]):
        self.e = emitter
        self.seq = emitter._next_seq()
        self.agent = agent
        self.label = label
        self.kind = kind
        self.node_edge = node_edge
        self._t0 = time.perf_counter()

    def _base(self) -> dict:
        ev = {"seq": self.seq, "agent": self.agent, "label": self.label,
              "kind": self.kind, "node_edge": self.node_edge}
        return {k: v for k, v in ev.items() if v is not None}

    async def think(self, thinking: str) -> None:
        await self.e._send({**self._base(), "status": "thinking", "thinking": thinking})

    async def stream(self, partial: str) -> None:
        await self.e._send({**self._base(), "status": "streaming", "thinking": partial})

    async def done(self, *, thinking: Optional[str] = None,
                   result: Optional[dict] = None,
                   latency_ms: Optional[int] = None) -> None:
        if latency_ms is None:
            latency_ms = int((time.perf_counter() - self._t0) * 1000)
        ev = {**self._base(), "status": "done", "latency_ms": latency_ms}
        if thinking is not None:
            ev["thinking"] = thinking
        if result is not None:
            ev["result"] = result
        await self.e._send(ev)


class StepEmitter:
    def __init__(self, sink: Sink):
        self._sink = sink
        self._seq = 0

    def _next_seq(self) -> int:
        self._seq += 1
        return self._seq

    async def _send(self, ev: dict) -> None:
        await self._sink(_validate(ev))

    def step(self, agent: str, label: str, kind: str,
             node_edge: Optional[list[str]] = None) -> Step:
        return Step(self, agent, label, kind, node_edge)

    async def decision(self, decision: dict, actions_preview: list[dict]) -> None:
        ev = {"seq": self._next_seq(), "kind": "decision", "status": "done",
              "decision": decision, "actions_preview": actions_preview}
        await self._send(ev)
