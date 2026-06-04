"""ETL -> feature stores. DETERMINISTIC. No LLM.

Builds, from the 21 CSVs, the cached feature stores every workstream reads:
  cache/passports.json       customer_id -> Passport
  cache/genomes.json         product_id  -> SkuGenome
  cache/stock_timeline.json  variant_id  -> [[date, running_balance], ...]
And one demo fixture grounded in real data:
  fixtures/rescue_case.json  a real recoverable Court Trainer size_too_small case

Run:  cd keeper/apps/api && python -m keeper_api.etl.build
"""
from __future__ import annotations
import csv
import json
from collections import defaultdict, Counter

from ..config import DATA_DIR, CACHE_DIR, FIXTURES_DIR
from ..engine.decision import LADDERS, sibling_size, SWAP_COST_GBP


def _load(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def run() -> None:
    customers = _load("customers.csv")
    orders = _load("orders.csv")
    line_items = _load("line_items.csv")
    refunds = _load("refunds.csv")
    variants = _load("variants.csv")
    products = _load("products.csv")
    pol = _load("po_line_items.csv")
    email_events = _load("email_events.csv")
    movements = _load("inventory_movements.csv")

    v_prod = {v["variant_id"]: v["product_id"] for v in variants}
    v_size = {v["variant_id"]: v["option1_value"] for v in variants}
    v_price = {v["variant_id"]: float(v["price"]) for v in variants}
    v_qty = {v["variant_id"]: int(float(v["inventory_quantity"])) for v in variants}
    p_type = {p["product_id"]: p["product_type"] for p in products}
    p_title = {p["product_id"]: p["title"] for p in products}
    landed = {pl["variant_id"]: float(pl["landed_cost_per_unit_gbp"]) for pl in pol}
    o_cust = {o["order_id"]: o["customer_id"] for o in orders}
    o_disc = {o["order_id"]: bool((o.get("discount_code") or "").strip()) for o in orders}

    returned_pairs = set()           # (order_id, variant_id)
    returned_by_cust = defaultdict(list)
    for r in refunds:
        try:
            vids = json.loads(r["refund_line_items"] or "[]")
        except (json.JSONDecodeError, TypeError):
            vids = []
        for vid in vids:
            returned_pairs.add((r["order_id"], vid))
            returned_by_cust[o_cust.get(r["order_id"])].append(
                {"product_type": p_type.get(v_prod.get(vid), ""),
                 "size": v_size.get(vid, ""), "reason": r["reason"]})

    engaged = {e["customer_id"] for e in email_events if e["event_type"] in ("open", "click")}

    # ---------- PASSPORTS ----------
    sizes_kept = defaultdict(lambda: defaultdict(set))   # cust -> type -> {sizes}
    disc_orders = defaultdict(int)
    for li in line_items:
        cust = o_cust.get(li["order_id"])
        if not cust:
            continue
        vid = li["variant_id"]
        ptype = p_type.get(v_prod.get(vid), "")
        if (li["order_id"], vid) not in returned_pairs:
            sizes_kept[cust][ptype].add(v_size.get(vid, ""))
    for o in orders:
        if o_disc.get(o["order_id"]):
            disc_orders[o["customer_id"]] += 1

    passports = {}
    for c in customers:
        cid = c["customer_id"]
        oc = int(c["orders_count"]) or 1
        passports[cid] = {
            "customer_id": cid,
            "name": f"{c['first_name']} {c['last_name']}",
            "email": c["email"],
            "ltv": float(c["total_spent"]),
            "orders_count": int(c["orders_count"]),
            "country": c["default_country"],
            "segment": c["gender_segment_affinity"],
            "acquisition": c["acquisition_source"],
            "discount_sensitivity": round(disc_orders.get(cid, 0) / oc, 3),
            "sizes_kept": {k: sorted(v) for k, v in sizes_kept.get(cid, {}).items()},
            "sizes_returned": returned_by_cust.get(cid, []),
            "email_engaged": cid in engaged,
            "contactable": (c.get("accepts_marketing") or "").lower() == "true",
        }
    (CACHE_DIR / "passports.json").write_text(json.dumps(passports))

    # ---------- GENOMES ----------
    units_sold = Counter()
    for li in line_items:
        units_sold[v_prod.get(li["variant_id"])] += int(float(li["quantity"]))
    prod_returns = defaultdict(Counter)   # product -> reason counter
    for r in refunds:
        try:
            vids = json.loads(r["refund_line_items"] or "[]")
        except (json.JSONDecodeError, TypeError):
            vids = []
        for vid in vids:
            prod_returns[v_prod.get(vid)][r["reason"]] += 1

    prod_variants = defaultdict(list)
    for v in variants:
        prod_variants[v["product_id"]].append(v)

    genomes = {}
    for p in products:
        pid = p["product_id"]
        rc = prod_returns.get(pid, Counter())
        tot_ret = sum(rc.values())
        us = units_sold.get(pid, 0)
        skew = {k: round(rc[k] / tot_ret, 3) for k in rc} if tot_ret else {}
        small = rc.get("size_too_small", 0)
        large = rc.get("size_too_large", 0)
        runs = "none"
        if tot_ret:
            if small / tot_ret >= 0.30 and small >= large:
                runs = "small"
            elif large / tot_ret >= 0.30 and large > small:
                runs = "large"
        vs = prod_variants[pid]
        prices = [v_price[v["variant_id"]] for v in vs]
        costs = [landed.get(v["variant_id"], 0.0) for v in vs]
        price = round(sorted(prices)[len(prices) // 2], 2) if prices else 0.0
        cost = round(sorted(costs)[len(costs) // 2], 2) if costs else 0.0
        genomes[pid] = {
            "product_id": pid, "title": p["title"], "product_type": p["product_type"],
            "size_ladder": LADDERS.get(p["product_type"], []),
            "units_sold": us, "returns": tot_ret,
            "return_rate": round(tot_ret / us, 4) if us else 0.0,
            "reason_skew": skew, "runs": runs,
            "price": price, "landed_cost": cost, "margin_per_unit": round(price - cost, 2),
            "current_stock_by_size": {v_size[v["variant_id"]]: v_qty[v["variant_id"]] for v in vs},
        }
    (CACHE_DIR / "genomes.json").write_text(json.dumps(genomes))

    # ---------- STOCK TIMELINE ----------
    timeline = defaultdict(list)
    for m in movements:
        timeline[m["variant_id"]].append([m["date"], int(float(m["running_balance"]))])
    for v in timeline:
        timeline[v].sort()
    (CACHE_DIR / "stock_timeline.json").write_text(json.dumps(timeline))

    # ---------- DEMO FIXTURE: a real recoverable Court Trainer case ----------
    psv = defaultdict(dict)
    for v in variants:
        psv[v["product_id"]][v_size[v["variant_id"]]] = v["variant_id"]

    fixture = None
    for r in refunds:
        if r["reason"] != "size_too_small":
            continue
        try:
            vids = json.loads(r["refund_line_items"] or "[]")
        except (json.JSONDecodeError, TypeError):
            vids = []
        if not vids:
            continue
        vid = vids[0]
        pid = v_prod.get(vid)
        if p_title.get(pid) != "Court Trainer":
            continue
        ptype, size = p_type[pid], v_size[vid]
        alt = sibling_size(ptype, size, r["reason"])
        alt_vid = psv.get(pid, {}).get(alt)
        if not alt_vid or v_qty.get(alt_vid, 0) <= 0:
            continue
        cid = o_cust.get(r["order_id"])
        amt = float(r["amount"])
        siblings = [
            {"variant_id": psv[pid][s], "size": s, "stock": v_qty.get(psv[pid][s], 0),
             "price": v_price.get(psv[pid][s], 0.0)}
            for s in genomes[pid]["size_ladder"] if s in psv[pid]
        ]
        fixture = {
            "rescue_id": "rsc_demo_0001",
            "customer_id": cid, "order_id": r["order_id"],
            "returned": {"variant_id": vid, "product_id": pid, "title": p_title[pid],
                         "size": size, "price": v_price.get(vid, 0.0),
                         "landed_cost": landed.get(vid, 0.0)},
            "reason_label": r["reason"],
            "reason_text": "These came up really tight across the toe, I think I need to size up.",
            "passport": passports.get(cid),
            "genome": genomes[pid],
            "siblings_in_stock": [s for s in siblings if s["stock"] > 0],
            "economics": {
                "refund_value": round(amt, 2),
                "recommended": "exchange",
                "exchange": {"to_size": alt, "to_variant": alt_vid,
                             "recovered_gbp": round(amt, 2),
                             "margin_gbp": round(amt - landed.get(vid, 0.0) - SWAP_COST_GBP, 2)},
            },
        }
        break
    if fixture:
        (FIXTURES_DIR / "rescue_case.json").write_text(json.dumps(fixture, indent=2))

    print(f"passports: {len(passports)} | genomes: {len(genomes)} | "
          f"stock timelines: {len(timeline)} | fixture: {'OK' if fixture else 'MISSING'}")
    if fixture:
        e = fixture["economics"]["exchange"]
        print(f"fixture: {fixture['returned']['title']} {fixture['returned']['size']}"
              f"->{e['to_size']}  recover £{e['recovered_gbp']}  margin £{e['margin_gbp']}")


if __name__ == "__main__":
    run()
