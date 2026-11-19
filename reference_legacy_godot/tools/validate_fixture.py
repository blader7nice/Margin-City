#!/usr/bin/env python3
"""Independent offline validator for prototype's FICTIONAL OHLC fixture and PnL."""
import json
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
payload = json.loads((PROJECT / "data" / "trading_synthetic.json").read_text(encoding="utf-8"))
metadata = payload["metadata"]
assert metadata["source"] == "synthetic_fixture_not_market_data", "Source must be explicit"
assert metadata["symbol"] == "DEMO/USD", "Do not pretend synthetic fixture is a real token"
bars = payload["candles"]
assert len(bars) == 20
for i, b in enumerate(bars):
    o, h, l, c = (float(b[k]) for k in ("o", "h", "l", "c"))
    assert 0 < l <= min(o, c) <= max(o, c) <= h, (i, b)
    if i:
        assert abs(float(bars[i - 1]["c"]) - o) < 1e-8, (i, "synthetic gaps")
entry = float(bars[11]["c"])
exit_price = float(bars[19]["c"])
notional = 100.0
cost = notional * (2 * 10 + 2 * 5) / 10_000
results = {
    "LONG": notional * (exit_price / entry - 1) - cost,
    "SHORT": notional * (1 - exit_price / entry) - cost,
    "POMIN": 0.0,
}
assert abs(results["LONG"] + results["SHORT"] + 2 * cost) < 1e-9
print("PASS: 20 synthetic OHLC bars consistent; no real market data")
print(f"Entry={entry:.2f}, exit={exit_price:.2f}, each-side fee 10 bps, each-side slippage 5 bps")
for key, value in results.items():
    print(f"  {key}: net PnL = ${value:+.4f}; ending cash=${1000 + value:.4f}")
