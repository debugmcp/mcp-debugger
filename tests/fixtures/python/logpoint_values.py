import time


def run():
    x = "café"
    total = 3.5
    items = [10, 20, 30, 40]
    entry = "old"
    step = 0
    step += 1  # case: repr
    step += 1  # case: format
    step += 1  # case: debug-conversion
    step += 1  # case: debug-spec
    step += 1  # case: debug
    step += 1  # case: debug-call
    step += 1  # case: dict
    step += 1  # case: slice
    step += 1  # case: joined
    # debugpy drops logpoint lines still queued when the program exits (#1265).
    time.sleep(0.05)
    return step


if __name__ == "__main__":
    run()
