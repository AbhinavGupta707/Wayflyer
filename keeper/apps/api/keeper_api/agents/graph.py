"""Keeper agent swarm — LangGraph state graph over Fireworks OSS models.

Pipeline:  intake -> triage -> context -> fit -> inventory -> economics
                  -> governor -> concierge -> learning -> (decision)

Division of labour (the hard rule from CONTRACTS.md):
  * Deterministic nodes (context, fit, inventory, economics, governor, learning-data)
    call the WS2 engine / WS1 features and emit `compute` StepEvents. They own every
    number and the decision itself.
  * LLM nodes (triage, concierge, learning-prose) call Fireworks and emit `reasoning`
    StepEvents (streamed `thinking`). They only phrase what the engine computed.

The terminal `decision` node emits the Contract-C `DecisionEvent`, whose `decision`
is *exactly* `engine.decision.decide(...)` — demo and backtest can never diverge.
"""
from __future__ import annotations

import asyncio
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, START, END

from ..engine.decision import (
    decide,
    sibling_size,
    AUTO_APPROVE_CEILING_GBP,
    SWAP_COST_GBP,
)
from . import llm
from .events import StepEmitter
from .loader import load_rescue, stock_lookup, variant_for_size


# --------------------------------------------------------------------------- state
class GS(TypedDict, total=False):
    rescue_id: str
    channel: str
    case: dict
    emitter: StepEmitter
    # accumulated node outputs
    reason: str
    sentiment: str
    to_size: Optional[str]
    confidence: float
    in_stock: bool
    units: int
    decision: dict          # engine Decision.as_dict()
    economics: dict
    governor: dict
    concierge: dict
    learning: Optional[dict]


# ---------------------------------------------------------------- learning trigger
SKEW_THRESHOLD = 0.55       # one size-reason dominates this share of returns
RATE_THRESHOLD = 0.15       # ...and the SKU returns at a material rate


def learning_triggered(genome: dict) -> Optional[str]:
    """Return the dominant size-skew direction ('runs_small'/'runs_large') or None."""
    skew = genome.get("reason_skew", {})
    rate = genome.get("return_rate", 0.0)
    small, large = skew.get("size_too_small", 0.0), skew.get("size_too_large", 0.0)
    top = max(small, large)
    if rate < RATE_THRESHOLD or top < SKEW_THRESHOLD:
        return None
    return "runs_small" if small >= large else "runs_large"


# ------------------------------------------------------------------ stream helper
async def _stream_reasoning(step, role: str, system: str, user: str, fallback: str) -> str:
    """Drive a reasoning node's typewriter; returns the final phrasing."""
    await step.think("…")
    final = fallback
    async for partial in llm.astream_words(role, system, user, fallback=fallback):
        final = partial
        await step.stream(partial)
    return final


_CONCIERGE_SYS = (
    "You are Keeper, a warm, concise retail concierge. You are given the EXACT offer "
    "the engine approved. Rephrase it into one friendly message. Do NOT change any size, "
    "price, or terms, and do NOT invent numbers. 1-2 sentences, first name only."
)
_TRIAGE_SYS = (
    "You classify a product-return message. Reply with a single short reasoning sentence "
    "using only the facts given. Never invent figures."
)
_FIT_SYS = (
    "You explain a sizing recommendation in one sentence using ONLY the provided figures. "
    "Never invent numbers."
)
_LEARNING_SYS = (
    "You draft a brief, professional internal note to a supplier about a sizing pattern, "
    "using ONLY the provided evidence. 2-3 sentences. Never invent figures."
)


def _heuristic_sentiment(text: str) -> str:
    t = (text or "").lower()
    if any(w in t for w in ("really", "tight", "frustrat", "annoy", "disappoint", "small")):
        return "mild_frustration"
    if any(w in t for w in ("love", "great", "perfect", "thanks")):
        return "positive"
    return "neutral"


# ----------------------------------------------------------------------- nodes
async def triage_node(s: GS) -> dict:
    """LLM: classify intent + sentiment, phrase the read. Engine keeps the canonical reason."""
    case, em = s["case"], s["emitter"]
    reason = case["reason_label"]                       # authoritative (engine input)
    text = case.get("reason_text", "")
    step = em.step("triage", "Triage Agent", "reasoning", ["intake", "triage"])
    sentiment = await llm.complete(
        "triage", _TRIAGE_SYS,
        f"Message: {text!r}\nReturn just one word for sentiment "
        f"(positive | neutral | mild_frustration | upset).",
        fallback=_heuristic_sentiment(text),
    )
    sentiment = sentiment.strip().split()[0].lower() if sentiment.strip() else _heuristic_sentiment(text)
    fallback = (f"Customer says '{text}'. Classifying intent as {reason} "
                f"with {sentiment.replace('_', ' ')}.")
    thinking = await _stream_reasoning(
        step, "triage", _TRIAGE_SYS,
        f"Message: {text!r}. Known reason code: {reason}. Sentiment: {sentiment}. "
        f"Write one sentence describing the read.",
        fallback,
    )
    await step.done(thinking=thinking, result={"reason": reason, "sentiment": sentiment})
    return {"reason": reason, "sentiment": sentiment}


async def context_node(s: GS) -> dict:
    """Compute: hydrate passport / genome / siblings."""
    case, em = s["case"], s["emitter"]
    step = em.step("context", "Context Loader", "compute", ["triage", "context"])
    p, g, r = case["passport"], case["genome"], case["returned"]
    thinking = "Hydrating rescue case — passport, SKU genome, sibling-size stock."
    await step.think(thinking)
    result = {
        "customer": p["name"],
        "ltv": p["ltv"],
        "sku": f"{g['title']} {r['size']}",
    }
    await step.done(thinking=thinking, result=result)
    return {}


async def fit_node(s: GS) -> dict:
    """Fit inference: deterministic corrective size (engine), LLM phrases the why."""
    case, em = s["case"], s["emitter"]
    g, r = case["genome"], case["returned"]
    reason = s["reason"]
    to_size = sibling_size(g["product_type"], r["size"], reason)
    skew = g.get("reason_skew", {}).get(reason, 0.0)
    confidence = round(min(0.95, 0.30 + skew), 2)
    step = em.step("fit", "Fit Agent", "reasoning", ["context", "fit"])
    runs = g.get("runs", "small")
    pct = round(skew * 100)
    fallback = (f"{g['title']} runs {runs} — {pct}% of its returns are {reason}. "
                f"Customer returned {r['size']}. Ladder step "
                f"{'up' if reason == 'size_too_small' else 'down'} -> {to_size}.")
    thinking = await _stream_reasoning(
        step, "triage", _FIT_SYS,
        f"Product {g['title']} runs {runs}; {pct}% of returns are {reason}; "
        f"customer returned {r['size']}; corrective size is {to_size}. One sentence.",
        fallback,
    )
    await step.done(thinking=thinking, result={"to_size": to_size, "confidence": confidence})
    return {"to_size": to_size, "confidence": confidence}


async def inventory_node(s: GS) -> dict:
    """Compute: point-in-time stock for the corrective size."""
    case, em = s["case"], s["emitter"]
    to_size = s.get("to_size")
    units = stock_lookup(case)(to_size) if to_size else 0
    step = em.step("inventory", "Inventory Agent", "compute", ["fit", "inventory"])
    thinking = f"Checking point-in-time stock for {to_size}..."
    await step.think(thinking)
    result = {"size": to_size, "in_stock": units > 0, "units": units}
    await step.done(thinking=thinking, result=result)
    return {"in_stock": units > 0, "units": units}


async def economics_node(s: GS) -> dict:
    """Compute: THE decision. engine.decide owns every number — no LLM here."""
    case, em = s["case"], s["emitter"]
    g, r = case["genome"], case["returned"]
    refund = round(float(case["economics"]["refund_value"]), 2)
    d = decide(
        reason=s["reason"],
        product_type=g["product_type"],
        size=r["size"],
        refund_amount=refund,
        landed_cost=float(r["landed_cost"]),
        alt_in_stock_fn=stock_lookup(case),
    ).as_dict()
    step = em.step("economics", "Economics Agent", "compute", ["inventory", "economics"])
    margin = d["margin_gbp"]
    thinking = (
        f"Refund loses the GBP {refund:.2f} sale. "
        f"{'Exchange keeps it. ' if d['action'] == 'exchange' else ''}"
        f"Margin after COGS ({float(r['landed_cost']):.2f}) and swap cost "
        f"({SWAP_COST_GBP:.2f}) = {margin:.2f}."
    )
    await step.think(thinking)
    result = {"refund": -refund, "exchange_margin": margin, "recommended": d["action"]}
    await step.done(thinking=thinking, result=result)
    return {"decision": d, "economics": result}


async def governor_node(s: GS) -> dict:
    """Compute: policy gate — auto vs one-tap approval. Reads engine's requires_approval."""
    case, em = s["case"], s["emitter"]
    d = s["decision"]
    refund = round(float(case["economics"]["refund_value"]), 2)
    requires_approval = bool(d["requires_approval"])
    step = em.step("governor", "Action Governor", "compute", ["economics", "governor"])
    if requires_approval:
        thinking = (f"Value GBP {refund:.2f} is over the {AUTO_APPROVE_CEILING_GBP:.0f} "
                    f"auto-ceiling -> low risk but flag for one-tap approval. Margin floor passed.")
    else:
        thinking = (f"Value GBP {refund:.2f} within the {AUTO_APPROVE_CEILING_GBP:.0f} "
                    f"auto-ceiling and margin floor passed -> auto-approve.")
    await step.think(thinking)
    gov = {"auto": not requires_approval, "requires_approval": requires_approval}
    await step.done(thinking=thinking, result=gov)
    return {"governor": gov}


async def concierge_node(s: GS) -> dict:
    """LLM: draft the warm, on-brand offer. Phrases the engine's offer; invents nothing."""
    case, em = s["case"], s["emitter"]
    d, p, r = s["decision"], case["passport"], case["returned"]
    channel = s.get("channel", "voice")
    first = p["name"].split()[0]
    step = em.step("concierge", "Concierge Agent", "reasoning", ["governor", "concierge"])

    if d["action"] == "exchange":
        to = d["to_size"]
        fallback = (f"Hi {first} — saw the {case['genome']['title']}s came up "
                    f"{'tight' if s['reason'] == 'size_too_small' else 'roomy'}. Want me to ship the "
                    f"{to} out to you today and keep the same price? I'll pop a prepaid label in "
                    f"for the {r['size']}s.")
        facts = (f"Customer first name: {first}. Product: {case['genome']['title']}. "
                 f"Approved offer: exchange {r['size']} -> {to}, same price, ship today, "
                 f"prepaid return label for the {r['size']}s.")
    elif d["action"] == "refund":
        fallback = (f"Hi {first} — no problem at all. I've started your refund for the "
                    f"{case['genome']['title']}; a prepaid return label is on its way.")
        facts = (f"Customer first name: {first}. Approved offer: full refund for the "
                 f"{case['genome']['title']} + prepaid return label.")
    else:  # waitlist
        fallback = (f"Hi {first} — the size you need is briefly out of stock. I can add you to "
                    f"the waitlist and notify you the moment it lands, or refund you now — your call.")
        facts = (f"Customer first name: {first}. Approved offer: waitlist for corrective size "
                 f"or refund.")

    thinking_intro = ("Drafting a warm, on-brand offer: "
                      + ("ship the corrective size today, keep the price, prepaid label."
                         if d["action"] == "exchange" else fallback))
    message = await _stream_reasoning(step, "concierge", _CONCIERGE_SYS, facts, fallback)
    await step.done(thinking=thinking_intro,
                    result={"channel": channel, "message": message})
    return {"concierge": {"channel": channel, "message": message}}


async def learning_node(s: GS) -> dict:
    """Learning: when a SKU's return-skew crosses threshold, draft REAL back-office
    artifacts — size-chart patch, buying flag, supplier note. LLM phrases the note."""
    case, em = s["case"], s["emitter"]
    g = case["genome"]
    signal = learning_triggered(g)
    if signal is None:
        return {"learning": None}

    skew = g["reason_skew"]
    dom = "size_too_small" if signal == "runs_small" else "size_too_large"
    pct = round(skew.get(dom, 0.0) * 100)
    offset = +1 if signal == "runs_small" else -1
    direction = "up" if signal == "runs_small" else "down"

    size_chart_patch = {
        "product_id": g["product_id"],
        "product_type": g["product_type"],
        "advisory": f"Runs {'small' if signal == 'runs_small' else 'large'} — "
                    f"we recommend sizing {direction}.",
        "recommended_offset": offset,
        "evidence": {"return_rate": g.get("return_rate"), f"{dom}_skew": skew.get(dom)},
    }
    buying_flag = {
        "sku": g["title"],
        "signal": signal,
        "guidance": (f"Skew buy {'+1 size' if signal == 'runs_small' else '-1 size'}: "
                     f"trim the smallest sizes, deepen the corrective end of the ladder."),
    }

    step = em.step("learning", "Learning Agent", "reasoning", ["concierge", "learning"])
    note_fallback = (
        f"Hi team — flagging a consistent sizing pattern on the {g['title']}: "
        f"{pct}% of returns are '{dom}' against a {round(g.get('return_rate', 0) * 100)}% "
        f"return rate. The SKU runs {'small' if signal == 'runs_small' else 'large'}; "
        f"please review the last and consider grading the pattern {direction} a half size."
    )
    supplier_note = await _stream_reasoning(
        step, "concierge", _LEARNING_SYS,
        f"Product: {g['title']}. Evidence: {pct}% of returns are {dom}; overall return rate "
        f"{round(g.get('return_rate', 0) * 100)}%; the SKU runs "
        f"{'small' if signal == 'runs_small' else 'large'}. Draft the supplier note.",
        note_fallback,
    )

    learning = {
        "signal": signal,
        "size_chart_patch": size_chart_patch,
        "buying_flag": buying_flag,
        "supplier_note": supplier_note,
    }
    await step.done(
        thinking=f"{g['title']} crossed the return-skew threshold ({pct}% {dom}). "
                 f"Drafting size-chart patch, buying flag, and supplier note.",
        result={"signal": signal, "artifacts": ["size_chart_patch", "buying_flag", "supplier_note"]},
    )
    return {"learning": learning}


def _build_actions(s: GS) -> list[dict]:
    """Assemble Contract-A ActionObjects from the engine decision + learning artifacts."""
    case = s["case"]
    d = s["decision"]
    rid = s["rescue_id"]
    g, r = case["genome"], case["returned"]
    channel = s.get("channel", "voice")
    actions: list[dict] = []

    def A(action_type, payload, impact=0.0, approval=False, real=False):
        return {
            "action_type": action_type, "rescue_id": rid, "payload": payload,
            "expected_margin_impact": impact, "requires_approval": approval,
            "status": "queued", "real": real,
        }

    if d["action"] == "exchange":
        to = d["to_size"]
        actions.append(A("create_exchange", {"from": r["size"], "to": to},
                         impact=d["margin_gbp"], approval=d["requires_approval"]))
        actions.append(A("reserve_inventory",
                         {"variant": variant_for_size(case, to) or to, "qty": 1}))
    elif d["action"] == "refund":
        actions.append(A("process_refund", {"amount": d["recovered_gbp"] or
                                             round(float(case["economics"]["refund_value"]), 2)},
                         approval=d["requires_approval"]))
    else:  # waitlist
        actions.append(A("create_waitlist", {"size": s.get("to_size")}))

    # Reach out to the customer (genuinely executed in the demo).
    contact = "make_voice_call" if channel == "voice" else "send_message"
    actions.append(A(contact, {"to": "customer"}, real=True))

    # Learning artifacts -> real back-office actions.
    learn = s.get("learning")
    if learn:
        actions.append(A("flag_to_buying",
                         {"sku": g["title"], "signal": learn["signal"]}, real=True))
        actions.append(A("publish_size_chart_patch", learn["size_chart_patch"], real=True))
        actions.append(A("draft_supplier_note",
                         {"sku": g["title"], "note": learn["supplier_note"]}, real=True))
    return actions


async def decision_node(s: GS) -> dict:
    """Terminal: emit the Contract-C DecisionEvent. decision == engine's decision."""
    em = s["emitter"]
    actions = _build_actions(s)
    await em.decision(s["decision"], actions)
    return {}


# ------------------------------------------------------------------- graph build
def build_graph():
    g = StateGraph(GS)
    g.add_node("triage", triage_node)
    g.add_node("context", context_node)
    g.add_node("fit", fit_node)
    g.add_node("inventory", inventory_node)
    g.add_node("economics", economics_node)
    g.add_node("governor", governor_node)
    g.add_node("concierge", concierge_node)
    g.add_node("learning", learning_node)
    g.add_node("decision", decision_node)

    g.add_edge(START, "triage")
    g.add_edge("triage", "context")
    g.add_edge("context", "fit")
    g.add_edge("fit", "inventory")
    g.add_edge("inventory", "economics")
    g.add_edge("economics", "governor")
    g.add_edge("governor", "concierge")
    g.add_edge("concierge", "learning")
    g.add_edge("learning", "decision")
    g.add_edge("decision", END)
    return g.compile()


_GRAPH = None


def _graph():
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


# ----------------------------------------------------------------- run interfaces
async def astream_events(rescue_id: str, channel: str = "voice"):
    """Async generator of Contract-C event dicts for `rescue_id`.

    Runs the compiled graph in a task; nodes push StepEvents onto a queue which we
    drain in real time. Yields each StepEvent then the terminal DecisionEvent.
    """
    case = load_rescue(rescue_id)
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    async def sink(ev: dict):
        await queue.put(ev)

    emitter = StepEmitter(sink)
    state: GS = {
        "rescue_id": rescue_id,
        "channel": channel or "voice",
        "case": case,
        "emitter": emitter,
    }

    async def run():
        try:
            await _graph().ainvoke(state)
        finally:
            await queue.put(_DONE)

    task = asyncio.create_task(run())
    try:
        while True:
            ev = await queue.get()
            if ev is _DONE:
                break
            yield ev
        await task  # surface any node exception
    finally:
        if not task.done():
            task.cancel()


async def _collect(rescue_id: str, channel: str = "voice", *, pretty: bool = False) -> list[dict]:
    events: list[dict] = []
    async for ev in astream_events(rescue_id, channel):
        events.append(ev)
        if not pretty:
            continue
        if ev.get("kind") == "decision":
            d = ev["decision"]
            print(f"  [decision] {d['branch']} -> {d['action']} {d.get('to_size') or ''} "
                  f"| recovered £{d['recovered_gbp']} margin £{d['margin_gbp']} "
                  f"| approval={d['requires_approval']} | {len(ev['actions_preview'])} actions")
        elif ev.get("status") == "done":
            print(f"  [{ev['seq']}] {ev['label']:<16} {ev['kind']:<9} "
                  f"{ev.get('latency_ms', 0)}ms  {ev.get('result')}")
    return events


def run_demo(rescue_id: str = "rsc_demo_0001", channel: str = "voice") -> list[dict]:
    """Replay the swarm end-to-end and print the stream. Returns the event list.

    Works offline (no FIREWORKS_API_KEY) — the engine drives every number; only the
    phrasing degrades to deterministic templates.
    """
    print(f"\n=== Keeper swarm replay: {rescue_id} "
          f"({'Fireworks online' if llm.have_key() else 'offline templates'}) ===")
    events = asyncio.run(_collect(rescue_id, channel, pretty=True))
    print(f"=== {len(events)} events streamed ===\n")
    return events


if __name__ == "__main__":
    import sys

    run_demo(sys.argv[1] if len(sys.argv) > 1 else "rsc_demo_0001")
