# WS1 — Data / ETL & Feature Store

**Mission:** harden the feature-store builders so the live API serves real passports/genomes/stock.
**Owns:** `apps/api/keeper_api/etl/`  (+ may add `apps/api/keeper_api/features.py` accessors)
**Reads:** Contract A (`packages/contracts/schemas.py`), raw CSVs in `pretty_fly_data_pack/data/`.

## Build
1. Keep/extend `etl/build.py` (already produces `cache/{passports,genomes,stock_timeline}.json` + `fixtures/rescue_case.json`).
2. Add `features.py` with cached accessors used by the API/agents:
   - `passport(customer_id) -> Passport`
   - `genome(product_id) -> SkuGenome`
   - `stock_at(variant_id, ts) -> int`  (point-in-time, from stock_timeline)
   - `siblings_in_stock(variant_id, at) -> list[Sibling]`
3. (Optional) switch cache to parquet via DuckDB/pandas for speed; keep JSON fallback.
4. Validate every Passport/SkuGenome instance against the Pydantic models.

## Run / verify
```bash
cd apps/api && python3 -m keeper_api.etl.build
python3 -c "from keeper_api.features import passport, genome, stock_at; print(passport('cust_000081')['name'])"
```
Cross-check against `pretty_fly_data_pack/validate.py` (rules 7, 16, 17) for stock/COGS sanity.

## Done =
Accessors return Contract-A-valid objects for any id; cache rebuilds in <30s; API can import `features`.

## Don't touch
`engine/`, `agents/`, `apps/web/`, the contract files.
