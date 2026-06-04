"""Central paths/config for Keeper.

REPO_ROOT/
  pretty_fly_data_pack/data/   <- source CSVs (read-only)
  keeper/cache/                <- generated feature stores + ledger (gitignored)
  keeper/fixtures/             <- committed demo fixtures (mocks for parallel WS)
"""
from pathlib import Path

# config.py -> keeper_api -> api -> apps -> keeper -> REPO_ROOT
REPO_ROOT = Path(__file__).resolve().parents[4]
DATA_DIR = REPO_ROOT / "pretty_fly_data_pack" / "data"
KEEPER_DIR = REPO_ROOT / "keeper"
CACHE_DIR = KEEPER_DIR / "cache"
FIXTURES_DIR = KEEPER_DIR / "fixtures"

CACHE_DIR.mkdir(parents=True, exist_ok=True)
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
