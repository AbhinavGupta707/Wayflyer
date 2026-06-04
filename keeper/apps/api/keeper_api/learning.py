"""Live fit-memory — the self-improving layer.

The genome's "runs small" signal is computed once from 24 months of history. THIS
module captures what we learn from each *new* return as it's processed, so:
  • the SKU's fit note updates (buying team + future shoppers),
  • the customer's own fit pattern updates (personal recommendations),
without re-running the whole ETL. Persisted to cache/learnings.json.
"""
from __future__ import annotations
import json

from .config import CACHE_DIR

_FILE = CACHE_DIR / "learnings.json"


def _load() -> dict:
    try:
        return json.loads(_FILE.read_text())
    except Exception:
        return {"returns": [], "sku_fit": {}, "customer_fit": {}}


def _save(d: dict) -> None:
    try:
        _FILE.write_text(json.dumps(d))
    except OSError:
        pass


def record_return(case: dict, action: str, accepted: bool) -> str:
    """Record a processed return; update SKU + customer fit memory. Returns a
    customer-facing note describing what we just learned (or '')."""
    d = _load()
    ret = case.get("returned", {})
    pid = ret.get("product_id", "")
    title = ret.get("title", "this item")
    reason = case.get("reason_label", "")
    cid = case.get("customer_id", "")

    d["returns"].append({
        "rescue_id": case.get("rescue_id"), "product_id": pid, "title": title,
        "size": ret.get("size"), "reason": reason, "action": action, "accepted": accepted,
        "customer_id": cid,
    })

    sk = d["sku_fit"].setdefault(pid, {"title": title, "too_small": 0, "too_large": 0, "total": 0, "note": ""})
    sk["total"] += 1
    note = ""
    if reason == "size_too_small":
        sk["too_small"] += 1
        sk["note"] = note = f"We've added a note to recommend sizing **up** on the {title} — it's been running small."
    elif reason == "size_too_large":
        sk["too_large"] += 1
        sk["note"] = note = f"We've added a note to recommend sizing **down** on the {title}."

    cf = d["customer_fit"].setdefault(cid, {"size_up": 0, "size_down": 0})
    if reason == "size_too_small":
        cf["size_up"] += 1
    elif reason == "size_too_large":
        cf["size_down"] += 1

    _save(d)
    return note


def sku_note(product_id: str) -> str:
    return _load().get("sku_fit", {}).get(product_id, {}).get("note", "")


def all_learnings() -> dict:
    return _load()
