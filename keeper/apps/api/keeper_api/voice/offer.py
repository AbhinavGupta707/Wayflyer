"""Build the *spoken* version of an already-decided rescue offer.

The hard rule (CONTRACTS.md): the engine owns every number and the decision.
Voice only narrates. So this module never recomputes economics — it reads the
RescueCase / Decision that WS2/WS3 produced and shapes the words around them.

Source priority for the script the customer hears:
  1. an explicit `offer_text` handed to /voice/start (e.g. the concierge draft),
  2. the concierge message recorded in the agent step-stream (seq 7 today),
  3. a deterministic, on-brand fallback template built from the case fields.
"""
from __future__ import annotations
import json
from typing import Optional

from pydantic import BaseModel

from ..config import FIXTURES_DIR


class VoiceOffer(BaseModel):
    rescue_id: str
    customer_name: str          # full name
    first_name: str
    product_title: str
    from_size: str
    to_size: Optional[str] = None
    price: float
    currency: str = "GBP"
    action: str = "exchange"    # exchange | refund | waitlist
    recovered_gbp: float = 0.0
    margin_gbp: float = 0.0
    # words
    greeting: str
    script: str                 # the full offer the voice speaks first
    confirm_line: str           # spoken after a "yes"
    decline_line: str           # spoken after a "no"
    # convenience for the ElevenLabs widget (seeds its system-prompt variables)
    dynamic_variables: dict = {}


def _first_name(full: str) -> str:
    return (full or "there").strip().split(" ")[0] or "there"


def _load_rescue(rescue_id: str) -> dict:
    """Prefer the real built case for THIS rescue_id; fall back to fixture."""
    try:
        from ..intake import get_case  # the case the customer actually picked
        c = get_case(rescue_id)
        if c:
            return c
    except Exception:
        pass
    try:
        from .. import main as _m  # late import — avoids circular import at boot
        if getattr(_m, "RESCUE", None):
            return _m.RESCUE
    except Exception:
        pass
    try:
        return json.loads((FIXTURES_DIR / "rescue_case.json").read_text())
    except Exception:
        return {}


def _concierge_message() -> Optional[str]:
    """The drafted offer prose from the agent stream, if present."""
    try:
        from .. import main as _m
        stream = getattr(_m, "STREAM", None)
    except Exception:
        stream = None
    if not stream:
        try:
            stream = json.loads((FIXTURES_DIR / "step_stream.json").read_text())
        except Exception:
            stream = []
    for ev in stream or []:
        res = ev.get("result") or {}
        if ev.get("agent") == "concierge" and res.get("message"):
            return res["message"]
    return None


def build_offer(rescue_id: str, offer_text: Optional[str] = None) -> VoiceOffer:
    case = _load_rescue(rescue_id) or {}
    passport = case.get("passport", {})
    returned = case.get("returned", {})
    econ = case.get("economics", {})
    exch = (econ.get("exchange") or {}) if isinstance(econ, dict) else {}

    full_name = passport.get("name", "there")
    first = _first_name(full_name)
    product = returned.get("title", "your order")
    from_size = returned.get("size", "")
    to_size = exch.get("to_size") or econ.get("to_size")
    price = float(returned.get("price", econ.get("refund_value", 0.0)) or 0.0)
    recommended = (econ.get("recommended") or "exchange").lower()

    greeting = f"Hi {first}, quick one from Pretty Fly."

    # 1: caller-supplied prose wins (e.g. the live concierge draft passed to /start).
    #    (We don't reuse the fixture step-stream's concierge line — it's the demo
    #     case, not this customer's item — so a real pick gets the grounded template.)
    script_body = offer_text

    if not script_body:
        # 3: deterministic fallback that narrates the decided action.
        if recommended == "exchange" and to_size:
            script_body = (
                f"Your {product} runs small, so I'll send you the {to_size} today at the "
                f"same price, with a prepaid return label for the {from_size}. Sound good?"
            )
        else:
            script_body = f"I can get the refund on your {product} moving right away. Shall I go ahead?"

    # Avoid double-greeting when the drafted prose already opens with "Hi/Hello/Hey".
    body_lc = script_body.lstrip().lower()
    if body_lc.startswith(("hi ", "hi,", "hello", "hey", "hi " + first.lower())):
        script = script_body.strip()
    else:
        script = f"{greeting} {script_body}".strip()

    if recommended == "exchange" and to_size:
        confirm_line = f"Perfect — your {to_size} is on the way and the label's in your email. Thanks!"
    else:
        confirm_line = "All done — your refund's on its way. Thanks!"
    decline_line = "No problem — I'll refund you now. Thanks!"

    offer = VoiceOffer(
        rescue_id=rescue_id,
        customer_name=full_name,
        first_name=first,
        product_title=product,
        from_size=from_size,
        to_size=to_size,
        price=price,
        action=recommended,
        recovered_gbp=float(exch.get("recovered_gbp", econ.get("refund_value", 0.0)) or 0.0),
        margin_gbp=float(exch.get("margin_gbp", 0.0) or 0.0),
        greeting=greeting,
        script=script,
        confirm_line=confirm_line,
        decline_line=decline_line,
    )
    offer.dynamic_variables = {
        "customer_name": full_name,
        "first_name": first,
        "product_title": product,
        "from_size": from_size,
        "to_size": to_size or "",
        "price": f"{price:.0f}",
        "currency": offer.currency,
        "offer_script": script,
    }
    return offer
