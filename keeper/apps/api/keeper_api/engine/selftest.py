"""WS2 self-tests. Run: cd keeper/apps/api && python -m keeper_api.engine.selftest

Guards the one property that makes the £ number credible: the ledger is
deterministic and the live decision matches the backtest decision.
"""
from __future__ import annotations
import json

from .backtest import compute
from .decision import live_decide
from ..config import FIXTURES_DIR


def test_reproducible():
    a = compute()["summary"]
    b = compute()["summary"]
    assert a == b, "ledger is NOT reproducible run-to-run"


def test_live_decide_matches_fixture():
    rc = json.loads((FIXTURES_DIR / "rescue_case.json").read_text())
    d = live_decide(rc)
    assert d.action == "exchange", f"expected exchange, got {d.action}"
    assert d.to_size == "UK8", f"expected UK8, got {d.to_size}"
    assert d.recoverable and d.margin_gbp > 0


def test_invariants():
    s = compute()["summary"]
    assert s["addressable_count"] <= s["size_refunds"]
    assert s["addressable_margin_gbp"] <= s["addressable_recovered_gbp"]
    assert s["realistic_margin_gbp"] <= s["addressable_margin_gbp"]
    assert s["conservative_margin_gbp"] <= s["addressable_margin_gbp"]


if __name__ == "__main__":
    test_reproducible()
    test_live_decide_matches_fixture()
    test_invariants()
    print("ALL WS2 TESTS PASS")
