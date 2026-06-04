"""Rescue-case hydration (the `context` node's data layer).

WS1's `features.py` is the eventual source of truth; until it lands this loads the
committed demo fixture (`fixtures/rescue_case.json`) and falls back to the generated
cache. No LLM, no decisions — just data assembly.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Callable

from ..config import CACHE_DIR, FIXTURES_DIR


def _read(path, default):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default


@lru_cache(maxsize=1)
def _fixture() -> dict:
    return _read(FIXTURES_DIR / "rescue_case.json", {})


def load_rescue(rescue_id: str) -> dict:
    """Return a RescueCase dict (Contract A) for `rescue_id`.

    Only the demo case is fixtured today; unknown ids reuse the fixture's shape
    with the requested id so the loop never hard-fails during the hackathon.
    """
    case = dict(_fixture())
    if not case:
        raise FileNotFoundError("fixtures/rescue_case.json missing — run WS1 ETL")
    case["rescue_id"] = rescue_id or case.get("rescue_id", "rsc_demo_0001")
    return case


def stock_lookup(case: dict) -> Callable[[str], int]:
    """Point-in-time stock for a sibling size, from genome + sibling snapshot.

    Mirrors `engine.decide`'s `alt_in_stock_fn` contract: size -> available units.
    """
    by_size: dict[str, int] = dict(case.get("genome", {}).get("current_stock_by_size", {}))
    for sib in case.get("siblings_in_stock", []):
        # The sibling snapshot is the authoritative live count when present.
        by_size[sib["size"]] = sib.get("stock", by_size.get(sib["size"], 0))

    def _fn(size: str) -> int:
        return int(by_size.get(size, 0))

    return _fn


def variant_for_size(case: dict, size: str) -> str:
    for sib in case.get("siblings_in_stock", []):
        if sib.get("size") == size:
            return sib.get("variant_id", "")
    return ""
