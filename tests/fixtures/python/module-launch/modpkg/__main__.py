"""Entry point of the module-launch fixture (issue #985 M0)."""
import sys


def main() -> int:
    greeting = "module launch"
    count = len(sys.argv)
    total = count + 41  # line 8: the integration test's breakpoint
    print(f"{greeting}: argv={count} total={total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
