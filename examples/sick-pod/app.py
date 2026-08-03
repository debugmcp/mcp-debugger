"""Checkout service for the sick-pod tutorial (docs/jit-diagnostics/).

Contains a deliberate state-dependent bug that produces wrong order totals
only after certain traffic patterns — and logs nothing suspicious, which is
the point: you cannot find this in the logs, but a debugger attached to the
live process finds it in minutes.

Run under debugpy (as the Dockerfile does):
    python -m debugpy --listen 0.0.0.0:5678 app.py
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

# Prices in cents
PRICES = {"apple": 150, "banana": 75, "cherry": 300}

# "Optimization": cache the price list for each distinct cart shape.
# The bug: the cached list OBJECT is returned to callers, and one code path
# mutates it in place — silently corrupting the cache for every later request
# with the same cart shape.
_cart_cache: dict = {}


def build_cart(items: list) -> list:
    key = tuple(sorted(items))
    if key not in _cart_cache:
        _cart_cache[key] = [PRICES[item] for item in items]
    return _cart_cache[key]


def apply_bulk_discount(prices: list) -> int:
    # 10% off any line >= $3.00 — but it mutates the (shared, cached) list.
    for i, price in enumerate(prices):
        if price >= 300:
            prices[i] = int(price * 0.9)
    return sum(prices)


class CheckoutHandler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 (stdlib naming)
        if self.path != "/checkout":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        order = json.loads(self.rfile.read(length) or b"{}")
        items = order.get("items", [])
        prices = build_cart(items)
        if order.get("bulk"):
            total = apply_bulk_discount(prices)
        else:
            total = sum(prices)
        body = json.dumps({"items": items, "total_cents": total}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # quiet: totals are never logged
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), CheckoutHandler).serve_forever()
