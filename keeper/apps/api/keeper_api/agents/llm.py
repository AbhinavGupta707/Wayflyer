"""Fireworks OSS LLM wrappers for the Keeper swarm.

THE HARD RULE (Contract C): the LLM controls **words** only — interpreting input,
classifying sentiment, drafting prose. It never invents a number, a size, an offer,
or a decision. Every figure handed to these helpers comes from the deterministic
engine (`engine/decision.py`). If `FIREWORKS_API_KEY` is unset, every helper falls
back to a deterministic template so the demo still replays end-to-end offline — the
numbers are identical either way, only the phrasing differs.

Model routing (per TASK_WS3):
  triage            -> llama-v3p1-8b-instruct      (fast intent/sentiment)
  tool / structured -> firefunction-v2             (structured extraction)
  concierge / draft -> llama-v3p3-70b-instruct      (warm, on-brand prose)
"""
from __future__ import annotations

import os
from typing import AsyncIterator, Optional

MODELS = {
    "triage": "accounts/fireworks/models/gpt-oss-120b",
    "structured": "accounts/fireworks/models/gpt-oss-120b",
    "concierge": "accounts/fireworks/models/deepseek-v4-pro",
}

# Temperatures kept low — this is a transactional CX agent, not a poet.
_TEMP = {"triage": 0.0, "structured": 0.0, "concierge": 0.4}

_clients: dict[str, object] = {}


def have_key() -> bool:
    # Live LLM is OFF by default — the swarm uses deterministic templates (clean,
    # fast, no token loops). Opt back in with KEEPER_LIVE_LLM=1 once desired.
    if os.getenv("KEEPER_LIVE_LLM", "").lower() not in ("1", "true", "yes"):
        return False
    return bool(os.getenv("FIREWORKS_API_KEY"))


def _client(role: str):
    """Lazily build (and cache) a ChatFireworks client, or None when offline."""
    if not have_key():
        return None
    if role in _clients:
        return _clients[role]
    try:
        from langchain_fireworks import ChatFireworks
    except Exception:
        return None
    client = ChatFireworks(
        model=MODELS[role],
        temperature=_TEMP.get(role, 0.2),
        max_tokens=512,
    )
    _clients[role] = client
    return client


def _messages(system: str, user: str):
    from langchain_core.messages import HumanMessage, SystemMessage

    return [SystemMessage(content=system), HumanMessage(content=user)]


def _chunk_words(text: str, n: int = 4) -> list[str]:
    """Split a template into cumulative chunks so the typewriter still animates offline."""
    words = text.split()
    out, acc = [], []
    for i, w in enumerate(words):
        acc.append(w)
        if (i + 1) % n == 0:
            out.append(" ".join(acc))
    if not out or len(" ".join(acc)) > len(out[-1]):
        out.append(" ".join(acc))
    return out


async def astream_words(
    role: str, system: str, user: str, *, fallback: str
) -> AsyncIterator[str]:
    """Yield the *cumulative* text as it is produced (drives the typewriter).

    Online: streams real Fireworks tokens. Offline: replays the deterministic
    `fallback` in small chunks so the UI animates identically.
    """
    client = _client(role)
    if client is None:
        for partial in _chunk_words(fallback):
            yield partial
        return
    try:
        acc = ""
        async for chunk in client.astream(_messages(system, user)):
            piece = getattr(chunk, "content", "") or ""
            if piece:
                acc += piece
                yield acc
        if not acc:
            yield fallback
    except Exception:
        # Any Fireworks hiccup must never break the deterministic demo.
        for partial in _chunk_words(fallback):
            yield partial


async def complete(role: str, system: str, user: str, *, fallback: str) -> str:
    """Non-streaming completion; returns `fallback` when offline or on error."""
    client = _client(role)
    if client is None:
        return fallback
    try:
        resp = await client.ainvoke(_messages(system, user))
        text = (getattr(resp, "content", "") or "").strip()
        return text or fallback
    except Exception:
        return fallback
