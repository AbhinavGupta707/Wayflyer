"""Feature-store accessors — the read API over the ETL caches. DETERMINISTIC. No LLM.

The live API and the agents read passports / genomes / point-in-time stock through
this module instead of touching CSVs or cache files directly. Everything is served
from the JSON caches built by `keeper_api.etl.build`:

  cache/passports.json       customer_id -> Passport      (Contract A)
  cache/genomes.json         product_id  -> SkuGenome      (Contract A)
  cache/stock_timeline.json  variant_id  -> [[iso_ts, running_balance], ...]
  cache/variants.json        variant_id  -> {product_id, size, price, ...}

Returned objects are plain dicts in the exact Contract-A shape (so they serialise to
JSON unchanged and support `passport(id)["name"]`). Stdlib only — importing this module
pulls in no pydantic / fastapi, so it is cheap for every workstream to depend on.

If the caches are missing on first access they are built on demand, so a fresh checkout
can `from keeper_api.features import passport` without a manual build step first.

  from keeper_api.features import passport, genome, stock_at, siblings_in_stock
  passport("cust_000081")["name"]            # -> "Blessing Nowak"
  stock_at("var_000053", "2025-06-01")        # -> point-in-time running balance
  siblings_in_stock("var_000045", "2025-06-01")  # -> in-stock sibling sizes
"""
from __future__ import annotations

import bisect
import json
from datetime import date, datetime
from functools import lru_cache
from typing import Optional, Union

from .config import CACHE_DIR

# A point in time may be given as an ISO string, a date, or a datetime.
TimePoint = Union[str, date, datetime, None]

_CACHE_FILES = ("passports.json", "genomes.json", "stock_timeline.json", "variants.json")


def _ensure_built() -> None:
    """Build the caches if any are missing (e.g. a fresh checkout)."""
    if all((CACHE_DIR / f).exists() for f in _CACHE_FILES):
        return
    from .etl.build import run as build_run
    build_run()


@lru_cache(maxsize=1)
def _passports() -> dict:
    _ensure_built()
    return json.loads((CACHE_DIR / "passports.json").read_text())


@lru_cache(maxsize=1)
def _genomes() -> dict:
    _ensure_built()
    return json.loads((CACHE_DIR / "genomes.json").read_text())


@lru_cache(maxsize=1)
def _timeline() -> dict:
    _ensure_built()
    return json.loads((CACHE_DIR / "stock_timeline.json").read_text())


@lru_cache(maxsize=1)
def _variants() -> dict:
    _ensure_built()
    return json.loads((CACHE_DIR / "variants.json").read_text())


@lru_cache(maxsize=1)
def _variants_by_product() -> dict:
    """product_id -> [variant_id, ...] in size-ladder order (best effort)."""
    by_product: dict[str, list[str]] = {}
    for vid, v in _variants().items():
        by_product.setdefault(v["product_id"], []).append(vid)
    # Order each product's variants along its genome size ladder so siblings come
    # out small -> large; variants whose size isn't on the ladder go last.
    genomes = _genomes()
    for pid, vids in by_product.items():
        ladder = genomes.get(pid, {}).get("size_ladder", [])
        order = {s: i for i, s in enumerate(ladder)}
        vids.sort(key=lambda vid: order.get(_variants()[vid]["size"], len(order)))
    return by_product


def reload() -> None:
    """Drop memoised caches so the next accessor call re-reads disk.

    Call after rebuilding the caches inside a long-running process.
    """
    for fn in (_passports, _genomes, _timeline, _variants, _variants_by_product):
        fn.cache_clear()


# --------------------------------------------------------------------------- #
# Accessors
# --------------------------------------------------------------------------- #

def passport(customer_id: str) -> dict:
    """Return the Contract-A Passport (dict) for a customer. Raises KeyError if unknown."""
    try:
        return _passports()[customer_id]
    except KeyError:
        raise KeyError(f"no passport for customer_id={customer_id!r}") from None


def genome(product_id: str) -> dict:
    """Return the Contract-A SkuGenome (dict) for a product. Raises KeyError if unknown."""
    try:
        return _genomes()[product_id]
    except KeyError:
        raise KeyError(f"no genome for product_id={product_id!r}") from None


def variant(variant_id: str) -> dict:
    """Return the variant index row (product_id, size, price, landed_cost, ...).

    Raises KeyError if unknown.
    """
    try:
        return _variants()[variant_id]
    except KeyError:
        raise KeyError(f"no variant for variant_id={variant_id!r}") from None


def _normalise_ts(at: TimePoint) -> Optional[str]:
    """Coerce a time point to an ISO string comparable to the timeline timestamps.

    A date-only value (len 10, e.g. '2025-06-01') is pushed to end-of-day so that
    same-day movements are counted as having already happened. None means 'latest'.
    """
    if at is None:
        return None
    if isinstance(at, datetime):
        return at.isoformat()
    if isinstance(at, date):
        return f"{at.isoformat()}T23:59:59"
    s = str(at)
    if len(s) == 10:  # 'YYYY-MM-DD'
        return f"{s}T23:59:59"
    return s


def stock_at(variant_id: str, at: TimePoint = None) -> int:
    """Point-in-time stock for a variant: running balance as of `at` (inclusive).

    `at` accepts an ISO string, date, or datetime; None returns the latest balance.
    Returns 0 if the variant has no movement at or before `at` (or is unknown), matching
    the reality that nothing had been received yet. Stock can be negative (the source
    data oversells), so callers wanting "available" should treat <= 0 as out of stock.
    """
    series = _timeline().get(variant_id)
    if not series:
        return 0
    ts = _normalise_ts(at)
    if ts is None:
        return int(series[-1][1])
    # series is sorted ascending by ISO timestamp; find the rightmost entry <= ts.
    dates = [row[0] for row in series]
    idx = bisect.bisect_right(dates, ts) - 1
    if idx < 0:
        return 0
    return int(series[idx][1])


def siblings_in_stock(variant_id: str, at: TimePoint = None) -> list[dict]:
    """Other size variants of the same product that are in stock (>0) as of `at`.

    Returns Contract-A `Sibling` dicts {variant_id, size, stock, price}, ordered along
    the product's size ladder, excluding the queried variant itself. Returns [] if the
    variant is unknown.
    """
    row = _variants().get(variant_id)
    if not row:
        return []
    out: list[dict] = []
    for sib_id in _variants_by_product().get(row["product_id"], []):
        if sib_id == variant_id:
            continue
        stock = stock_at(sib_id, at)
        if stock <= 0:
            continue
        sib = _variants()[sib_id]
        out.append({
            "variant_id": sib_id,
            "size": sib["size"],
            "stock": stock,
            "price": sib["price"],
        })
    return out


# --------------------------------------------------------------------------- #
# Bulk accessors (handy for the catalog endpoint / agents)
# --------------------------------------------------------------------------- #

def all_passports() -> dict:
    """customer_id -> Passport (the whole store; do not mutate)."""
    return _passports()


def all_genomes() -> dict:
    """product_id -> SkuGenome (the whole store; do not mutate)."""
    return _genomes()


if __name__ == "__main__":  # pragma: no cover — quick smoke check
    p = passport("cust_000081")
    print("passport:", p["name"], "| ltv", p["ltv"])
    g = genome("prod_00005")
    print("genome:", g["title"], "| return_rate", g["return_rate"])
    print("stock_at(var_000053, now):", stock_at("var_000053"))
    print("siblings_in_stock(var_000045, now):",
          [(s["size"], s["stock"]) for s in siblings_in_stock("var_000045")])
