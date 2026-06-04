"""Deterministic, templated agent step-stream for a rescue (NO LLM, NO streaming).

Produces the canonical Contract-C StepEvents the agent view replays — exactly one
per node, grounded in the real case + the engine's decision. This is the reliable
demo path: no Fireworks, no token loops, one clean card per agent. Covers every
branch (exchange / waitlist / fast-refund).
"""
from __future__ import annotations

from .engine.decision import live_decide

REASON_PHRASE = {
    "size_too_small": "too small", "size_too_large": "too large",
    "changed_mind": "changed their mind", "quality_issue": "a quality issue",
    "damaged_in_transit": "damaged in transit", "not_as_described": "not as described",
}


def build_step_stream(case: dict) -> list[dict]:
    d = live_decide(case)
    ret = case.get("returned", {})
    g = case.get("genome", {}) or {}
    p = case.get("passport", {}) or {}
    title = ret.get("title", "the item")
    size = ret.get("size", "")
    reason = case.get("reason_label", "")
    rl = REASON_PHRASE.get(reason, reason.replace("_", " "))
    name = p.get("name", "the customer")
    first = name.split(" ")[0]
    ltv = p.get("ltv", 0)
    runs = g.get("runs", "none")
    to_size = d.to_size
    refund_value = float((case.get("economics") or {}).get("refund_value", ret.get("price", 0)) or 0)
    landed = float(ret.get("landed_cost", 0) or 0)
    skew = g.get("reason_skew", {}) or {}

    steps: list[dict] = []

    def step(agent, label, kind, thinking, result, edge, ms):
        steps.append({"seq": len(steps) + 1, "agent": agent, "label": label, "kind": kind,
                      "status": "done", "thinking": thinking, "result": result,
                      "node_edge": edge, "latency_ms": ms})

    step("triage", "Triage Agent", "reasoning",
         f"{first} wrote: “{case.get('reason_text','')}”. Classifying the reason and sentiment.",
         {"reason": reason, "sentiment": "mild_frustration" if reason.startswith("size") else "neutral"},
         ["intake", "triage"], 520)
    step("context", "Context Loader", "compute",
         f"Loading {name}'s passport (LTV £{ltv:.0f}) + the {title} genome and live sibling stock.",
         {"customer": name, "ltv": ltv, "sku": f"{title} {size}"}, ["triage", "context"], 110)

    if reason in ("size_too_small", "size_too_large"):
        pct = int(round(skew.get(reason, 0) * 100))
        step("fit", "Fit Agent", "reasoning",
             f"{title} runs {runs} — {pct}% of its returns are {rl}. {first} returned {size}; "
             f"corrective size is {to_size or 'n/a'}.",
             {"to_size": to_size, "runs": runs}, ["context", "fit"], 470)
        step("inventory", "Inventory Agent", "compute",
             f"Checking live stock for {to_size or 'the swap size'}…",
             {"size": to_size, "in_stock": d.action == "exchange"}, ["fit", "inventory"], 90)

        if d.action == "exchange":
            step("economics", "Economics Agent", "compute",
                 f"Refund loses the £{refund_value:.0f} sale. Exchange keeps it — margin after COGS "
                 f"(£{landed:.0f}) and swap cost = £{d.margin_gbp:.2f}.",
                 {"refund": -refund_value, "exchange_margin": d.margin_gbp, "recommended": "exchange"},
                 ["inventory", "economics"], 100)
            step("governor", "Action Governor", "compute",
                 f"£{refund_value:.0f} {'over' if d.requires_approval else 'within'} the auto-approve ceiling → "
                 f"{'one-tap approval' if d.requires_approval else 'auto-approve'}. Margin floor passed.",
                 {"auto": not d.requires_approval, "requires_approval": d.requires_approval},
                 ["economics", "governor"], 40)
            step("concierge", "Concierge Agent", "reasoning",
                 f"Drafting the offer: swap {size}→{to_size}, keep the price, prepaid label.",
                 {"channel": "voice",
                  "message": f"Hi {first} — saw the {title} came up {rl}. I can ship the {to_size} today at the "
                             f"same price, with a prepaid label for the {size}. Want me to set that up?"},
                 ["governor", "concierge"], 380)
        else:  # waitlist (corrective size OOS)
            step("economics", "Economics Agent", "compute",
                 f"The {to_size or 'corrective size'} is out of stock right now — no exchange can ship. "
                 "Offer a restock waitlist, else refund.",
                 {"recommended": "waitlist"}, ["inventory", "economics"], 100)
            step("governor", "Action Governor", "compute",
                 "No in-stock swap → waitlist + refund. No margin at risk.",
                 {"auto": True, "requires_approval": False}, ["economics", "governor"], 40)
            step("concierge", "Concierge Agent", "reasoning",
                 "Drafting a waitlist + refund message.",
                 {"channel": "voice",
                  "message": f"Hi {first} — the {to_size or 'next size'} in the {title} is out of stock right now. "
                             "I can add you to the waitlist and refund you in the meantime. Sound good?"},
                 ["governor", "concierge"], 360)
    else:
        qa = reason in ("quality_issue", "damaged_in_transit", "not_as_described")
        step("fit", "Fit Agent", "reasoning",
             f"Reason is '{rl}', not a sizing problem — no size swap applies.",
             {"to_size": None}, ["context", "fit"], 210)
        step("inventory", "Inventory Agent", "compute",
             "No exchange to stock-check.", {"in_stock": False}, ["fit", "inventory"], 60)
        step("economics", "Economics Agent", "compute",
             f"Fast refund of £{refund_value:.0f}" + (" + flag the batch for supplier QC." if qa else " (buyer's remorse)."),
             {"recommended": "refund"}, ["inventory", "economics"], 90)
        step("governor", "Action Governor", "compute",
             "Refund within policy → process now" + (" + QC flag." if qa else "."),
             {"auto": True, "requires_approval": False}, ["economics", "governor"], 40)
        step("concierge", "Concierge Agent", "reasoning",
             "Drafting a fast-refund message.",
             {"channel": "voice",
              "message": f"Hi {first} — sorry the {title} was {rl}. I'll get your refund moving right away"
                         + (" and flag this batch to our team." if qa else ".") + " Shall I go ahead?"},
             ["governor", "concierge"], 340)

    if runs in ("small", "large") and reason.startswith("size"):
        step("learning", "Learning Agent", "reasoning",
             f"{title} keeps coming back {rl} — flagging the buying team + a size-chart note.",
             {"flag": "runs_" + runs, "sku": title}, ["concierge", "learning"], 300)

    # ---- terminal decision ----
    if d.action == "exchange":
        actions = [
            {"action_type": "create_exchange", "payload": {"from": size, "to": to_size},
             "expected_margin_impact": d.margin_gbp, "requires_approval": d.requires_approval, "status": "queued", "real": False},
            {"action_type": "reserve_inventory", "payload": {"size": to_size, "qty": 1},
             "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": False},
            {"action_type": "make_voice_call", "payload": {"to": "customer"},
             "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": True},
        ]
        if runs in ("small", "large"):
            actions.append({"action_type": "flag_to_buying", "payload": {"sku": title, "signal": "runs_" + runs},
                            "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": True})
    elif d.action == "waitlist":
        actions = [
            {"action_type": "create_waitlist", "payload": {"sku": title, "size": to_size},
             "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": False},
            {"action_type": "process_refund", "payload": {"amount": round(refund_value, 2)},
             "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": False},
        ]
    else:
        actions = [{"action_type": "process_refund", "payload": {"amount": round(refund_value, 2)},
                    "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": False}]
        if reason in ("quality_issue", "damaged_in_transit", "not_as_described"):
            actions.append({"action_type": "draft_supplier_note", "payload": {"sku": title, "reason": reason},
                            "expected_margin_impact": 0, "requires_approval": False, "status": "queued", "real": True})

    steps.append({"seq": len(steps) + 1, "kind": "decision", "status": "done",
                  "decision": d.as_dict(), "actions_preview": actions})
    return steps
