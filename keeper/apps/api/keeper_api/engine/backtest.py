"""Backtest engine -> the Rescue Ledger (the business-value proof).

Replays every historical refund through the deterministic decision engine,
using POINT-IN-TIME stock (was the corrective size in stock at refund time?).
ZERO LLM -> reproducible to the penny.

  compute()       pure -> {summary, entries}            (no side effects)
  live_summary()  memoised summary for GET /api/ledger  (WS2 wiring)
  run()           compute + write cache/fixtures + print

Run:  cd keeper/apps/api && python -m keeper_api.engine.backtest
Writes: keeper/cache/ledger.json  and  keeper/fixtures/ledger.sample.json
"""
from __future__ import annotations
import csv
import json
from bisect import bisect_right
from collections import defaultdict
from functools import lru_cache

from ..config import DATA_DIR, CACHE_DIR, FIXTURES_DIR
from .decision import decide, sibling_size, ACCEPT_RATE, RE_RETURN_HAIRCUT, SIZE_REASONS


def _load(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_stock_at(movements: list[dict]):
    """variant_id -> point-in-time stock lookup from inventory_movements.running_balance."""
    timeline: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for m in movements:
        timeline[m["variant_id"]].append((m["date"], int(float(m["running_balance"]))))
    for v in timeline:
        timeline[v].sort()

    def stock_at(variant_id: str | None, ts: str) -> int:
        arr = timeline.get(variant_id or "")
        if not arr:
            return 0
        i = bisect_right([d for d, _ in arr], ts) - 1
        return arr[i][1] if i >= 0 else 0

    return stock_at


def compute() -> dict:
    """Pure backtest. Returns {summary, entries}. No file writes, no LLM."""
    variants = _load("variants.csv")
    products = _load("products.csv")
    refunds = _load("refunds.csv")
    pol = _load("po_line_items.csv")
    line_items = _load("line_items.csv")
    movements = _load("inventory_movements.csv")

    v_prod = {v["variant_id"]: v["product_id"] for v in variants}
    v_size = {v["variant_id"]: v["option1_value"] for v in variants}
    p_type = {p["product_id"]: p["product_type"] for p in products}
    p_title = {p["product_id"]: p["title"] for p in products}
    landed = {pl["variant_id"]: float(pl["landed_cost_per_unit_gbp"]) for pl in pol}

    # per-product return rate -> residual re-return risk for the conservative view
    units_sold: dict[str, int] = defaultdict(int)
    for li in line_items:
        units_sold[v_prod.get(li["variant_id"], "")] += int(float(li["quantity"]))
    returns_ct: dict[str, int] = defaultdict(int)
    for r in refunds:
        try:
            for vid in json.loads(r["refund_line_items"] or "[]"):
                returns_ct[v_prod.get(vid, "")] += 1
        except (json.JSONDecodeError, TypeError):
            pass
    prod_return_rate = {p: (returns_ct[p] / units_sold[p]) if units_sold.get(p) else 0.0
                        for p in set(units_sold) | set(returns_ct)}

    psv: dict[str, dict[str, str]] = defaultdict(dict)
    for v in variants:
        psv[v_prod[v["variant_id"]]][v_size[v["variant_id"]]] = v["variant_id"]

    stock_at = build_stock_at(movements)

    entries: list[dict] = []
    for r in refunds:
        try:
            vids = json.loads(r["refund_line_items"] or "[]")
        except (json.JSONDecodeError, TypeError):
            vids = []
        if not vids:
            continue
        vid = vids[0]
        pid = v_prod.get(vid)
        ptype = p_type.get(pid, "")
        size = v_size.get(vid, "")
        amt = float(r["amount"])
        lc = landed.get(vid, 0.0)
        ts = r["created_at"]

        # is the corrective size known + in stock at refund time?
        alt = sibling_size(ptype, size, r["reason"]) if r["reason"] in SIZE_REASONS else None
        alt_vid = psv.get(pid, {}).get(alt) if alt else None
        alt_stock = stock_at(alt_vid, ts) if alt_vid else 0

        d = decide(r["reason"], ptype, size, amt, lc, lambda sz: alt_stock if sz == alt else 0)

        # conservative margin: a corrective up-size halves residual return risk
        residual = prod_return_rate.get(pid, 0.0) * RE_RETURN_HAIRCUT
        cons_margin = round(d.margin_gbp * (1 - residual), 2) if d.recoverable else 0.0

        entries.append({
            "refund_id": r["refund_id"], "reason": r["reason"],
            "sku": p_title.get(pid, pid), "product_type": ptype,
            "branch": d.branch, "action": d.action, "to_size": d.to_size,
            "recoverable": d.recoverable, "recovered_gbp": d.recovered_gbp,
            "margin_gbp": d.margin_gbp, "conservative_margin_gbp": cons_margin,
            "amount": round(amt, 2), "month": ts[:7],
            "lost_to_stockout": bool(alt and alt_stock <= 0),  # swap existed but OOS
        })

    # ---------------- aggregates ----------------
    size_entries = [e for e in entries if e["reason"] in SIZE_REASONS]
    rec = [e for e in entries if e["recoverable"]]
    stockout = [e for e in size_entries if e["lost_to_stockout"]]

    by_sku: dict[str, dict] = defaultdict(lambda: {"recoverable": 0, "recovered_gbp": 0.0, "margin_gbp": 0.0})
    for e in rec:
        s = by_sku[e["sku"]]
        s["recoverable"] += 1
        s["recovered_gbp"] = round(s["recovered_gbp"] + e["recovered_gbp"], 2)
        s["margin_gbp"] = round(s["margin_gbp"] + e["margin_gbp"], 2)

    by_month: dict[str, float] = defaultdict(float)
    for e in rec:
        by_month[e["month"]] = round(by_month[e["month"]] + e["recovered_gbp"], 2)

    by_reason: dict[str, dict] = defaultdict(lambda: {"count": 0, "refund_gbp": 0.0, "recoverable": 0, "recovered_gbp": 0.0})
    for e in entries:
        b = by_reason[e["reason"]]
        b["count"] += 1
        b["refund_gbp"] = round(b["refund_gbp"] + e["amount"], 2)
        if e["recoverable"]:
            b["recoverable"] += 1
            b["recovered_gbp"] = round(b["recovered_gbp"] + e["recovered_gbp"], 2)

    addressable_rev = round(sum(e["recovered_gbp"] for e in rec), 2)
    addressable_margin = round(sum(e["margin_gbp"] for e in rec), 2)
    conservative_margin = round(sum(e["conservative_margin_gbp"] for e in rec), 2)

    summary = {
        "total_refunds": len(entries),
        "size_refunds": len(size_entries),
        "size_refund_gbp": round(sum(e["amount"] for e in size_entries), 2),
        "addressable_count": len(rec),
        "addressable_recovered_gbp": addressable_rev,
        "addressable_margin_gbp": addressable_margin,
        "conservative_margin_gbp": conservative_margin,
        "accept_rate_assumed": ACCEPT_RATE,
        "realistic_recovered_gbp": round(addressable_rev * ACCEPT_RATE, 2),
        "realistic_margin_gbp": round(addressable_margin * ACCEPT_RATE, 2),
        "lost_to_stockout_count": len(stockout),
        "lost_to_stockout_gbp": round(sum(e["amount"] for e in stockout), 2),
        "top_skus": sorted(
            ({"sku": k, **v} for k, v in by_sku.items()),
            key=lambda x: x["recovered_gbp"], reverse=True,
        )[:10],
        "by_reason": dict(by_reason),
        "by_month": dict(sorted(by_month.items())),
    }
    return {"summary": summary, "entries": entries}


@lru_cache(maxsize=1)
def live_summary() -> dict:
    """Memoised summary for GET /api/ledger (computed once per process)."""
    return compute()["summary"]


def run() -> dict:
    ledger = compute()
    summary = ledger["summary"]
    (CACHE_DIR / "ledger.json").write_text(json.dumps(ledger, indent=2))
    (FIXTURES_DIR / "ledger.sample.json").write_text(json.dumps(summary, indent=2))

    print("=== RESCUE LEDGER (point-in-time stock, LLM-free) ===")
    for k, v in summary.items():
        if k not in ("top_skus", "by_month", "by_reason"):
            print(f"  {k:28} {v}")
    print("  top_skus (recoverable revenue):")
    for s in summary["top_skus"][:6]:
        print(f"    {s['sku']:24} n={s['recoverable']:4}  £{s['recovered_gbp']:>9.0f}  margin £{s['margin_gbp']:>8.0f}")
    return ledger


if __name__ == "__main__":
    run()
