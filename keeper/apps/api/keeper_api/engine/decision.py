"""Keeper decision engine — DETERMINISTIC. No LLM. Reproducible to the penny.

Single source of truth for: "what do we offer on this return?"
Used by BOTH the live agent loop and the offline backtest/ledger, so the
demo and the proof number can never diverge.

Design rules baked in (the 6 fixes):
  1. Reason-router, not just a fit engine (quality/damaged != exchange).
  2. Inventory-aware: only recommend a sibling size that is actually in stock
     (point-in-time in the backtest, live stock in production).
  3. Margin uses realised, discount-adjusted economics, minus swap cost.
  4. Swap logistics cost subtracted.
  5. Store credit is NOT part of the grounded claim (no credit history in data).
  6. Ledger reports addressable AND realistic (x acceptance rate).
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Callable, Optional

# Size ladders — verified from data: variants.option1_name == 'Size' (645/645).
LADDERS: dict[str, list[str]] = {
    "Tee":        ["XS", "S", "M", "L", "XL"],
    "Hoodie":     ["XS", "S", "M", "L", "XL"],
    "Sweatpants": ["XS", "S", "M", "L", "XL"],
    "Outerwear":  ["XS", "S", "M", "L", "XL"],
    "Trainer":    ["UK6", "UK7", "UK8", "UK9", "UK10", "UK11", "UK12"],
    "Cap":        ["ONE"],
}

SIZE_REASONS = {"size_too_small", "size_too_large"}
QUALITY_REASONS = {"quality_issue", "damaged_in_transit", "not_as_described"}

SWAP_COST_GBP = 5.0   # ship swap + process return (logistics drag on an exchange)
ACCEPT_RATE = 0.55    # assumed exchange-acceptance rate for the 'realistic' figure
AUTO_APPROVE_CEILING_GBP = 150.0  # above this -> human approval (governor)


def sibling_size(product_type: str, size: str, reason: str) -> Optional[str]:
    """The corrective size: one step up if it ran small, one down if too large."""
    ladder = LADDERS.get(product_type, [])
    if size not in ladder:
        return None
    i = ladder.index(size)
    if reason == "size_too_small" and i + 1 < len(ladder):
        return ladder[i + 1]
    if reason == "size_too_large" and i - 1 >= 0:
        return ladder[i - 1]
    return None


@dataclass
class Decision:
    branch: str          # 'fit_exchange' | 'fast_refund' | 'crosssell_or_refund'
    action: str          # 'exchange' | 'refund' | 'waitlist'
    to_size: Optional[str]
    recoverable: bool    # True only when an exchange genuinely saves the sale
    recovered_gbp: float # revenue kept vs refunding
    margin_gbp: float    # discount-adjusted margin retained, net of swap cost
    rationale: str
    requires_approval: bool

    def as_dict(self) -> dict:
        return asdict(self)


def decide(
    reason: str,
    product_type: str,
    size: str,
    refund_amount: float,
    landed_cost: float,
    alt_in_stock_fn: Callable[[str], int],
    margin_floor: float = 0.0,
) -> Decision:
    """Return the highest-margin save the policy allows.

    alt_in_stock_fn(alt_size) -> available units (live or point-in-time).
    """
    # --- Quality / damaged: never re-offer the same SKU; fast refund + QC flag ---
    if reason in QUALITY_REASONS:
        return Decision("fast_refund", "refund", None, False, 0.0, 0.0,
                        f"{reason}: fast refund + supplier QC flag", False)

    # --- Non-size (changed_mind, etc.): no size swap; refund (cross-sell elsewhere) ---
    if reason not in SIZE_REASONS:
        return Decision("crosssell_or_refund", "refund", None, False, 0.0, 0.0,
                        f"{reason}: no size swap applicable", False)

    # --- Fit branch: find an in-stock corrective size ---
    alt = sibling_size(product_type, size, reason)
    if alt is None or alt_in_stock_fn(alt) <= 0:
        return Decision("fit_exchange", "waitlist", None, False, 0.0, 0.0,
                        "corrective size unavailable in stock -> waitlist/refund", False)

    recovered = round(float(refund_amount), 2)
    margin = round(recovered - float(landed_cost) - SWAP_COST_GBP, 2)
    if margin < margin_floor:
        return Decision("fit_exchange", "refund", None, False, 0.0, 0.0,
                        "swap below margin floor -> refund", True)

    runs = "small" if reason == "size_too_small" else "large"
    return Decision(
        "fit_exchange", "exchange", alt, True, recovered, margin,
        f"runs {runs}; swap {size}->{alt}, keep the sale",
        requires_approval=recovered > AUTO_APPROVE_CEILING_GBP,
    )
