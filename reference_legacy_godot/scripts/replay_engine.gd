extends RefCounted
## Deterministic PAPER-ONLY replay calculation.
## No external services, orders, wallets, leverage, or payments.

static func evaluate(bars: Array, entry_index: int, exit_index: int, decision: String, position_notional: float = 100.0, fee_bps_per_side: float = 10.0, slippage_bps_per_side: float = 5.0) -> Dictionary:
    if entry_index < 0 or exit_index <= entry_index or exit_index >= bars.size():
        return {"ok": false, "error": "Invalid replay window"}
    if decision not in ["LONG", "SHORT", "POMIN"]:
        return {"ok": false, "error": "Invalid action"}
    if position_notional <= 0.0:
        return {"ok": false, "error": "Invalid notional"}
    var entry: float = float(bars[entry_index]["c"])
    var exit_price: float = float(bars[exit_index]["c"])
    if entry <= 0.0 or exit_price <= 0.0:
        return {"ok": false, "error": "Invalid prices"}
    if decision == "POMIN":
        return {"ok": true, "decision": decision, "entry": entry, "exit": exit_price, "gross_pnl": 0.0, "costs": 0.0, "net_pnl": 0.0}
    var sign: float = 1.0 if decision == "LONG" else -1.0
    var gross_pnl: float = sign * position_notional * (exit_price / entry - 1.0)
    # Assumption for prototype: fixed per-side notional, fee and slippage.
    # Real replay needs fills, stops, markouts, no-lookahead and dynamic fees.
    var costs: float = position_notional * (2.0 * fee_bps_per_side + 2.0 * slippage_bps_per_side) / 10000.0
    return {"ok": true, "decision": decision, "entry": entry, "exit": exit_price, "gross_pnl": gross_pnl, "costs": costs, "net_pnl": gross_pnl - costs}
