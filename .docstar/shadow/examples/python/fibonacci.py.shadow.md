# examples/python/fibonacci.py
@source-hash: bae9881f2c6491a0
@generated: 2026-02-10T00:41:38Z

**Purpose:** Test script for debugging MCP Server functionality, implementing Fibonacci number calculation using both recursive and iterative approaches with intentional bugs.

**Key Components:**

- `fibonacci_recursive(n)` (L9-16): Classic recursive Fibonacci implementation with base cases for n≤0 and n=1. Uses exponential time complexity O(2^n) due to redundant calculations.

- `fibonacci_iterative(n)` (L19-28): Optimized iterative Fibonacci implementation using two variables (a, b) with linear time complexity O(n). Handles edge case for n≤0.

- `main()` (L31-50): Demonstration function that calculates the 10th Fibonacci number using both methods, then introduces an intentional bug by adding 1 to the (n-1)th result and compares it to the correct nth result.

**Dependencies:** None - uses only Python built-ins.

**Architecture Pattern:** Simple procedural script with standalone functions. Designed as a debugging exercise with deliberate error injection.

**Key Invariants:**
- Both functions should return identical results for the same input
- The recursive approach has exponential complexity while iterative is linear
- The buggy calculation (L46) intentionally produces incorrect results for debugging practice

**Execution Flow:** When run as main module, calculates F(10) using both methods, introduces a bug, and triggers a debug message when the buggy value doesn't match the expected result.