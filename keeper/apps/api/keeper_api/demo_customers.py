"""Curated REAL customers + their REAL order history for the demo storefront.

The shopper "is" one of these real customers — their passport, their actual orders,
the actual sizes/colours they bought, and which items they really returned. Picking
"Return" on any line item runs that real item through Keeper's engine, so the demo
shows how a historically-refunded return would have been *saved* instead.

Selection is deterministic: customers with 3–10 orders and >=1 real size return,
ranked by (size-returns, order-count), 9 mens + 3 womens for variety.
"""
from __future__ import annotations
import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta
from functools import lru_cache

from .config import DATA_DIR, CACHE_DIR
from . import features

N_MENS, N_WOMENS = 9, 3
SIZE_REASONS = {"size_too_small", "size_too_large"}
TODAY = datetime(2026, 6, 1)  # "today" in the dataset world


def _order_status(created_at: str, has_return: bool) -> tuple[str, str]:
    """Derive a display status + a date line from the order age (mutually exclusive
    so the My-Orders tab counts sum to the total)."""
    try:
        created = datetime.fromisoformat(created_at[:19])
    except ValueError:
        created = TODAY
    days = (TODAY - created).days
    if has_return:
        return "Returns", "Return completed"
    if days <= 3:
        return "Processing", "Preparing your order"
    if days <= 10:
        arriving = (created + timedelta(days=6)).strftime("%b %-d, %Y")
        return "Shipped", f"Arriving {arriving}"
    delivered = (created + timedelta(days=4)).strftime("%b %-d, %Y")
    return "Delivered", f"Delivered on {delivered}"


def _load(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


@lru_cache(maxsize=1)
def _build() -> dict:
    customers = {c["customer_id"]: c for c in _load("customers.csv")}
    orders = _load("orders.csv")
    line_items = _load("line_items.csv")
    variants = {v["variant_id"]: v for v in _load("variants.csv")}
    ptype = {p["product_id"]: p["product_type"] for p in _load("products.csv")}
    genomes = features.all_genomes()
    addresses = {a["customer_id"]: a for a in _load("addresses.csv")}

    returned: dict[tuple, str] = {}
    for r in _load("refunds.csv"):
        try:
            for vid in json.loads(r["refund_line_items"] or "[]"):
                returned[(r["order_id"], vid)] = r["reason"]
        except (json.JSONDecodeError, TypeError):
            pass

    ord_by_cust: dict[str, list] = defaultdict(list)
    for o in orders:
        ord_by_cust[o["customer_id"]].append(o)
    li_by_ord: dict[str, list] = defaultdict(list)
    for l in line_items:
        li_by_ord[l["order_id"]].append(l)

    # --- score + select (deterministic) ---
    scored = []
    for cid, os in ord_by_cust.items():
        if not (3 <= len(os) <= 10):
            continue
        size_ret = sum(
            1 for o in os for l in li_by_ord[o["order_id"]]
            if returned.get((o["order_id"], l["variant_id"])) in SIZE_REASONS
        )
        if size_ret < 1:
            continue
        scored.append((size_ret, len(os), cid, customers[cid]["gender_segment_affinity"]))
    scored.sort(key=lambda x: (-x[0], -x[1], x[2]))
    chosen = [s[2] for s in scored if s[3] == "mens"][:N_MENS] \
        + [s[2] for s in scored if s[3] == "womens"][:N_WOMENS]

    # --- build real order histories ---
    out: dict[str, dict] = {}
    for cid in chosen:
        c = customers[cid]
        hist = []
        for o in sorted(ord_by_cust[cid], key=lambda o: o["created_at"]):
            items = []
            has_return = False
            for l in li_by_ord[o["order_id"]]:
                vid, pid = l["variant_id"], l["product_id"]
                v = variants.get(vid, {})
                key = (o["order_id"], vid)
                if key in returned:
                    has_return = True
                items.append({
                    "variant_id": vid, "product_id": pid, "title": l["title"].split(" - ")[0],
                    "product_type": ptype.get(pid, ""),
                    "size": v.get("option1_value", ""), "colour": v.get("option2_value", ""),
                    "quantity": int(l["quantity"]), "price": round(float(l["price"]), 2),
                    "returned": key in returned, "return_reason": returned.get(key),
                    "runs": genomes.get(pid, {}).get("runs", "none"),
                })
            status, status_line = _order_status(o["created_at"], has_return)
            hist.append({
                "order_id": o["order_id"], "order_number": o.get("order_number", ""),
                "created_at": o["created_at"], "total_price": round(float(o["total_price"]), 2),
                "item_count": sum(i["quantity"] for i in items),
                "status": status, "status_line": status_line,
                "items": items,
            })
        a = addresses.get(cid, {})
        addr = ", ".join(x for x in [a.get("address1"), a.get("city"),
                         a.get("province"), a.get("postcode")] if x) or a.get("country", "")
        out[cid] = {
            "customer_id": cid, "name": f"{c['first_name']} {c['last_name']}",
            "email": c["email"], "ltv": round(float(c["total_spent"]), 2),
            "orders_count": int(c["orders_count"]), "country": c["default_country"],
            "segment": c["gender_segment_affinity"], "address": addr, "orders": hist,
        }
    try:
        (CACHE_DIR / "demo_customers.json").write_text(json.dumps(out))
    except OSError:
        pass
    return out


def list_customers() -> list[dict]:
    """Lightweight summaries for the customer switcher."""
    return [
        {"customer_id": c["customer_id"], "name": c["name"], "ltv": c["ltv"],
         "orders_count": c["orders_count"], "segment": c["segment"], "country": c["country"]}
        for c in _build().values()
    ]


def customer_orders(customer_id: str) -> dict | None:
    return _build().get(customer_id)


if __name__ == "__main__":  # smoke check
    for c in list_customers():
        print(f"  {c['name']:22} {c['segment']:6} {c['country']}  orders={c['orders_count']:2}  ltv £{c['ltv']:.0f}")
