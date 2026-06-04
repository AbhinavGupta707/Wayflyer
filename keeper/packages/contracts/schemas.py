"""Keeper FROZEN CONTRACTS (Pydantic v2).

The single source of truth for every interface between workstreams.
Mirror of packages/contracts/types.ts — keep them in lock-step.

Contract A: domain / feature-store shapes (Passport, SkuGenome, RescueCase, ...)
Contract B: API request/response models
Contract C: agent step-event stream (StepEvent / DecisionEvent)
"""
from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel

# ===================== Contract A — domain / feature store =====================

class Passport(BaseModel):
    customer_id: str
    name: str
    email: str
    ltv: float
    orders_count: int
    country: str
    segment: str                       # 'mens' | 'womens'
    acquisition: str
    discount_sensitivity: float        # 0..1 share of orders with a code
    sizes_kept: dict[str, list[str]]   # product_type -> sizes kept
    sizes_returned: list[dict]         # [{product_type, size, reason}]
    email_engaged: bool
    contactable: bool


class SkuGenome(BaseModel):
    product_id: str
    title: str
    product_type: str
    size_ladder: list[str]
    units_sold: int
    returns: int
    return_rate: float
    reason_skew: dict[str, float]
    runs: Literal["small", "large", "none"]
    price: float
    landed_cost: float
    margin_per_unit: float
    current_stock_by_size: dict[str, int]


class Sibling(BaseModel):
    variant_id: str
    size: str
    stock: int
    price: float


class ExchangeOption(BaseModel):
    to_size: str
    to_variant: str
    recovered_gbp: float
    margin_gbp: float


class Economics(BaseModel):
    refund_value: float
    recommended: Literal["exchange", "store_credit", "refund", "waitlist"]
    exchange: Optional[ExchangeOption] = None


class ReturnedItem(BaseModel):
    variant_id: str
    product_id: str
    title: str
    size: str
    price: float
    landed_cost: float


class RescueCase(BaseModel):
    rescue_id: str
    customer_id: str
    order_id: str
    returned: ReturnedItem
    reason_label: str
    reason_text: str
    passport: Passport
    genome: SkuGenome
    siblings_in_stock: list[Sibling]
    economics: Economics


class Decision(BaseModel):
    branch: Literal["fit_exchange", "fast_refund", "crosssell_or_refund"]
    action: Literal["exchange", "refund", "waitlist"]
    to_size: Optional[str] = None
    recoverable: bool
    recovered_gbp: float
    margin_gbp: float
    rationale: str
    requires_approval: bool


ActionType = Literal[
    "create_exchange", "reserve_inventory", "process_refund", "issue_store_credit",
    "make_voice_call", "send_message", "create_waitlist",
    "publish_size_chart_patch", "flag_to_buying", "draft_supplier_note",
]


class ActionObject(BaseModel):
    action_type: ActionType
    rescue_id: str = ""
    payload: dict = {}
    expected_margin_impact: float = 0.0
    requires_approval: bool = False
    status: Literal["queued", "running", "done", "skipped"] = "queued"
    real: bool = False                 # True = genuinely executed in demo (voice/msg/drafts)


# ===================== Contract C — agent step-event stream =====================

class StepEvent(BaseModel):
    seq: int
    agent: str
    label: str
    kind: Literal["reasoning", "compute", "tool", "decision"]
    status: Literal["thinking", "streaming", "done"]
    thinking: Optional[str] = None     # drives the typewriter in the agent view
    result: Optional[dict] = None
    node_edge: Optional[list[str]] = None   # lights up the swarm graph
    latency_ms: Optional[int] = None


class DecisionEvent(BaseModel):
    seq: int
    kind: Literal["decision"] = "decision"
    status: Literal["done"] = "done"
    decision: Decision
    actions_preview: list[ActionObject]


# ===================== Contract B — API request/response =====================

class ReturnIntakeRequest(BaseModel):
    order_id: str
    variant_id: str
    reason_text: str = ""
    channel: Literal["chat", "voice"] = "chat"


class RescueIdResponse(BaseModel):
    rescue_id: str


class RespondRequest(BaseModel):
    accepted: bool


class RespondResponse(BaseModel):
    actions: list[ActionObject]
    confirmation: str


class LedgerSummary(BaseModel):
    total_refunds: int
    size_refunds: int
    size_refund_gbp: float
    addressable_count: int
    addressable_recovered_gbp: float
    addressable_margin_gbp: float
    accept_rate_assumed: float
    realistic_recovered_gbp: float
    realistic_margin_gbp: float
    top_skus: list[dict]
    by_month: dict[str, float]
