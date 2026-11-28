"""Simple long-lived Python service fixture for attach breakpoint tests (#1326).

Started under `python -m debugpy --listen 127.0.0.1:<port> attach_service.py`.
Prints ATTACH_SERVICE_READY once debugpy's listener is active and the module is
loaded, then calls `compute_total` in a bounded loop so live attach sessions
can bind and hit breakpoints without raw TCP port probes.
"""
import time


def compute_total(prices: list[int]) -> int:
    total = sum(prices)
    doubled = total * 2
    return doubled


def main() -> None:
    print("ATTACH_SERVICE_READY", flush=True)
    deadline = time.monotonic() + 25.0
    while time.monotonic() < deadline:
        compute_total([10, 20, 30])
        time.sleep(0.05)


if __name__ == "__main__":
    main()
