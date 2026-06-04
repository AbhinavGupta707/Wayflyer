"""ETL -> feature stores. DETERMINISTIC. No LLM.

Builds, from the 21 CSVs, the cached feature stores every workstream reads:
  cache/passports.json       customer_id -> Passport
  cache/genomes.json         product_id  -> SkuGenome
  cache/stock_timeline.json  variant_id  -> [[date, running_balance], ...]
  cache/variants.json        variant_id  -> {product_id, size, price, ...}  (accessor index)
And one demo fixture grounded in real data:
  fixtures/rescue_case.json  a real recoverable Court Trainer size_too_small case

Accessors over these stores live in `keeper_api/features.py`.

Run:  cd keeper/apps/api && python -m keeper_api.etl.build
"""
from __future__ import annotations
import csv
import importlib.util
import json
import os
from collections import defaultdict, Counter

from ..config import DATA_DIR, CACHE_DIR, FIXTURES_DIR, REPO_ROOT
from ..engine.decision import LADDERS, sibling_size, SWAP_COST_GBP


def _load(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _load_contracts():
    """Import the frozen Pydantic models from packages/contracts/schemas.py.

    Loaded by file path so the ETL has no hard dependency on the contracts package
    layout. Returns None if pydantic isn't installed (stdlib-only runs skip validation).
    """
    try:
        import pydantic  # noqa: F401
    except ImportError:
        return None
    import sys
    path = REPO_ROOT / "keeper" / "packages" / "contracts" / "schemas.py"
    spec = importlib.util.spec_from_file_location("keeper_contracts_schemas", path)
    mod = importlib.util.module_from_spec(spec)
    # Register before exec so pydantic can resolve the models' forward references
    # (schemas.py uses `from __future__ import annotations`).
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def _validate(passports: dict, genomes: dict) -> None:
    """Validate every Passport / SkuGenome instance against Contract A.

    Skipped (with a notice) when pydantic isn't available or KEEPER_SKIP_VALIDATE is set,
    so the stdlib-only `python -m keeper_api.etl.build` still works. Raises on any failure.
    """
    if os.environ.get("KEEPER_SKIP_VALIDATE"):
        print("validation: skipped (KEEPER_SKIP_VALIDATE set)")
        return
    contracts = _load_contracts()
    if contracts is None:
        print("validation: skipped (pydantic not installed)")
        return
    from pydantic import ValidationError

    errors: list[str] = []
    for cid, p in passports.items():
        try:
            contracts.Passport(**p)
        except ValidationError as e:
            errors.append(f"Passport {cid}: {e.errors()[:1]}")
    for pid, g in genomes.items():
        try:
            contracts.SkuGenome(**g)
        except ValidationError as e:
            errors.append(f"SkuGenome {pid}: {e.errors()[:1]}")
    if errors:
        preview = "\n  ".join(errors[:10])
        raise SystemExit(
            f"validation FAILED: {len(errors)} Contract-A violation(s):\n  {preview}"
        )
    print(f"validation: OK ({len(passports)} passports, {len(genomes)} genomes vs Contract A)")


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
    # variant_id -> [[iso_ts, balance], ...] giving point-in-time stock.
    #
    # IMPORTANT: the source `running_balance` column is sequenced by movement_id, and
    # movement_ids are assigned OUT of chronological order — so the recorded
    # running_balance at a given date is NOT a valid as-of balance (verified: var_000053's
    # last-by-date row reads -7, but the true current stock is 20). We therefore recompute
    # the balance as the cumulative sum of quantity_delta in (date, movement_id) order.
    # ISO timestamps sort lexicographically == chronologically, so features.stock_at() can
    # bisect the date column for an O(log n) point-in-time lookup. The final cumulative
    # equals variants.inventory_quantity (validate.py Rule 7), so stock_at(vid) with no
    # timestamp returns current stock and reconciles with genome.current_stock_by_size.
    moves_by_variant = defaultdict(list)
    for m in movements:
        moves_by_variant[m["variant_id"]].append(
            (m["date"], m["movement_id"], int(float(m["quantity_delta"])))
        )
    timeline = {}
    for vid, ms in moves_by_variant.items():
        ms.sort(key=lambda x: (x[0], x[1]))
        bal = 0
        series = []
        for dt, _mid, delta in ms:
            bal += delta
            series.append([dt, bal])
        timeline[vid] = series
    (CACHE_DIR / "stock_timeline.json").write_text(json.dumps(timeline))

    # Rule-7 self-check: each variant's final cumulative must equal inventory_quantity.
    bad_stock = [vid for vid, q in v_qty.items()
                 if (timeline[vid][-1][1] if vid in timeline else 0) != q]
    if bad_stock:
        raise SystemExit(
            f"stock timeline failed Rule-7 reconciliation for {len(bad_stock)} "
            f"variant(s), e.g. {bad_stock[:5]}"
        )

    # ---------- VARIANTS INDEX ----------
    # Flat variant_id -> attributes index that features.py uses to resolve a variant to
    # its product, size, price and landed cost (and to enumerate a product's siblings)
    # without re-reading the CSVs at request time.
    variant_index = {}
    for v in variants:
        vid = v["variant_id"]
        pid = v_prod.get(vid, "")
        variant_index[vid] = {
            "variant_id": vid,
            "product_id": pid,
            "product_type": p_type.get(pid, ""),
            "title": p_title.get(pid, ""),
            "sku": v.get("sku", ""),
            "size": v_size.get(vid, ""),
            "colour": v.get("option2_value", ""),  # products have size x colour variants
            "price": v_price.get(vid, 0.0),
            "landed_cost": round(landed.get(vid, 0.0), 2),
            "current_stock": v_qty.get(vid, 0),
        }
    (CACHE_DIR / "variants.json").write_text(json.dumps(variant_index))

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

    _validate(passports, genomes)

    print(f"passports: {len(passports)} | genomes: {len(genomes)} | "
          f"variants: {len(variant_index)} | stock timelines: {len(timeline)} | "
          f"fixture: {'OK' if fixture else 'MISSING'}")
    if fixture:
        e = fixture["economics"]["exchange"]
        print(f"fixture: {fixture['returned']['title']} {fixture['returned']['size']}"
              f"->{e['to_size']}  recover £{e['recovered_gbp']}  margin £{e['margin_gbp']}")


if __name__ == "__main__":
    run()
