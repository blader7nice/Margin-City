extends Control
## Schematic candlestick chart. Reveals only past/visible OHLC bars.

var candles: Array = []
var visible_bars: int = 12

func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, size), Color(0.055, 0.085, 0.13, 1.0), true)
    for line_index in range(1, 5):
        var gy: float = (size.y * float(line_index)) / 5.0
        draw_line(Vector2(0.0, gy), Vector2(size.x, gy), Color(0.25, 0.35, 0.43, 0.3), 1.0)
    if candles.is_empty():
        return

    var count: int = mini(visible_bars, candles.size())
    var lower: float = INF
    var upper: float = -INF
    # Do NOT peek into the future when scaling the unrevealed chart.
    for index in range(count):
        lower = minf(lower, float(candles[index]["l"]))
        upper = maxf(upper, float(candles[index]["h"]))
    var padding: float = maxf((upper - lower) * 0.15, 0.1)
    lower -= padding
    upper += padding
    var range_price: float = upper - lower
    var left_margin: float = 12.0
    var plot_width: float = size.x - 24.0
    var plot_height: float = size.y - 24.0
    var slot_width: float = plot_width / maxf(1.0, float(count))

    for index in range(count):
        var candle: Dictionary = candles[index]
        var open_price: float = float(candle["o"])
        var high_price: float = float(candle["h"])
        var low_price: float = float(candle["l"])
        var close_price: float = float(candle["c"])
        var x: float = left_margin + (float(index) + 0.5) * slot_width
        var y_open: float = 12.0 + (upper - open_price) / range_price * plot_height
        var y_close: float = 12.0 + (upper - close_price) / range_price * plot_height
        var y_high: float = 12.0 + (upper - high_price) / range_price * plot_height
        var y_low: float = 12.0 + (upper - low_price) / range_price * plot_height
        var color: Color = Color(0.18, 0.80, 0.56) if close_price >= open_price else Color(0.92, 0.33, 0.36)
        draw_line(Vector2(x, y_high), Vector2(x, y_low), color, 1.6)
        draw_rect(Rect2(x - minf(8.0, slot_width * 0.32), minf(y_open, y_close), minf(16.0, slot_width * 0.64), maxf(2.0, absf(y_close - y_open))), color, true)
