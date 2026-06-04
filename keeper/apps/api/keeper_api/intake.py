"""Return intake — builds a REAL RescueCase for ANY picked item. No hardcoding.

This is what makes the live demo general: a shopper picks any product + size +
reason in the store, and we assemble a Contract-A RescueCase from WS1's feature
accessors (real genome, real point-in-time stock, a real customer passport) and
let WS2's deterministic engine decide. The agent swarm then narrates that real
decision. Stdlib + engine only (no langgraph) so the API imports stay cheap.
"""
from __future__ import annotations

import uuid

from . import features
from .engine.decision import live_decide, SWAP_COST_GBP

# In-process store of built cases (single uvicorn worker). The agent loader and
# GET /api/rescue both read from here; falls back to the committed fixture.
_CASE_STORE: dict[str, dict] = {}

REASON_TEXT = {
    "size_too_small": "These came up too tight across the fit — I think I need to size up.",
    "size_too_large": "These came up too big on me — I think I need to size down.",
    "changed_mind": "I've changed my mind on these, I'd like to send them back.",
    "quality_issue": "There's a quality problem with these — stitching isn't right.",
    "damaged_in_transit": "These turned up damaged in the box.",
    "not_as_described": "These aren't quite what I expected from the description.",
}


def register_case(case: dict) -> None:
    _CASE_STORE[case["rescue_id"]] = case


def get_case(rescue_id: str) -> dict | None:
    return _CASE_STORE.get(rescue_id)


def resolve_variant(product_id: str, size: str, colour: str | None = None) -> str | None:
    """product_id + size (+ optional colour) -> a concrete variant_id."""
    vbp = features._variants_by_product().get(product_id, [])
    vars_ = features._variants()
    cands = [
        vid for vid in vbp
        if vars_[vid]["size"] == size and (colour is None or vars_[vid].get("colour") == colour)
    ]
    return cands[0] if cands else None


def _pick_passport(product_type: str) -> dict:
    """A real customer who has kept this product_type before (nice personalisation),
    else any real customer. Keeps the agent's 'context' step grounded, not synthetic."""
    passports = features.all_passports()
    for p in passports.values():
        if product_type in (p.get("sizes_kept") or {}):
            return p
    return next(iter(passports.values()))


def build_rescue_case(
    product_id: str, size: str, reason: str,
    *, customer_id: str | None = None, colour: str | None = None,
) -> dict:
    """Assemble a Contract-A RescueCase for any selection and run the real engine."""
    vid = resolve_variant(product_id, size, colour)
    if not vid:
        raise ValueError(f"no variant for product {product_id!r} size {size!r}")

    v = features.variant(vid)
    g = features.genome(product_id)
    siblings = features.siblings_in_stock(vid)        # live (now)
    refund_value = round(float(v["price"]), 2)
    landed = float(v.get("landed_cost", 0.0))

    if customer_id:
        try:
            passport = features.passport(customer_id)
        except KeyError:
            passport = _pick_passport(g["product_type"])
    else:
        passport = _pick_passport(g["product_type"])

    case = {
        "rescue_id": "rsc_" + uuid.uuid4().hex[:8],
        "customer_id": passport["customer_id"],
        "order_id": "ord_demo",
        "returned": {
            "variant_id": vid, "product_id": product_id, "title": g["title"],
            "size": size, "price": refund_value, "landed_cost": landed,
        },
        "reason_label": reason,
        "reason_text": REASON_TEXT.get(reason, "I'd like to return this."),
        "passport": passport,
        "genome": g,
        "siblings_in_stock": siblings,
        "economics": {"refund_value": refund_value, "recommended": "refund", "exchange": None},
    }

    # The deterministic engine decides — same code path as the backtest.
    d = live_decide(case)
    case["economics"]["recommended"] = d.action
    if d.action == "exchange" and d.to_size:
        to_vid = next((s["variant_id"] for s in siblings if s["size"] == d.to_size), "")
        case["economics"]["exchange"] = {
            "to_size": d.to_size, "to_variant": to_vid,
            "recovered_gbp": d.recovered_gbp, "margin_gbp": d.margin_gbp,
        }

    register_case(case)
    return case
